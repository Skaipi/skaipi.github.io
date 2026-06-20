---
title: Calling a Native AOT C# Library from Python
layout: markdown_post
---
# Calling a Native AOT C# Library from Python with ctypes
Python remains dominant in data science and AI not because CPython is fast at CPU-bound work, but because it is very good at orchestrating native code. The hot path usually lives elsewhere: C, C++, Rust, or some other compiled runtime. Python stays in control, while the expensive work happens behind a narrow ABI boundary. Native Ahead of Time (AOT) compilation makes C# a credible option for that role as well: it can publish a self-contained shared library, and methods marked with `UnmanagedCallersOnly` plus a non-null `EntryPoint` are emitted as native exports. On the Python side, functions loaded through `ctypes.CDLL` use the C calling convention and release the GIL for the duration of the foreign call.

This article shows how to expose a small C ABI from C# and call it from Python with `ctypes`. The examples target .NET 9, but the design applies more broadly to Native AOT shared libraries. This article deliberately avoids hosting .NET from Python. It uses Native AOT to publish a small C ABI around managed implementation code. Examples presented below are purely pedagogical and provided "as is", without warranty of any kind.
## Why this approach works
CPython knows nothing about managed objects, generics, garbage collection, or .NET exception metadata. It understands native symbols, calling conventions, and raw memory. That is the level where the integration has to happen. Native AOT allows us to bridge .NET world with python contract by compiling reachable Intermediate Language (IL) into native code and producing a shared library that CPython code can load directly.

There is one immediate constraint: the exported surface must actually look like native code. `UnmanagedCallersOnly` (a attribute that we will use extensively here) methods must be `static`, must not be called from managed code, must use only blittable arguments (those which have straightforward conversion between managed and unmanaged form), and must not be generic or be contained in a generic type. That is why a C ABI for Python is usually built from primitive scalars, pointers, opaque handles, and explicit status codes.
## Build configuration
A Native AOT library is published for a specific runtime identifier, so build commands should include a RID such as `win-x64`, `linux-x64`, or `osx-arm64`. For this workflow, use a shared library, not a static library. Static libraries are not officially supported by `ctypes`, and unloading a Native AOT shared library with `dlclose` or `FreeLibrary` is not supported either.

A minimal project file looks like this:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <PublishAot>true</PublishAot>
    <NativeLib>Shared</NativeLib>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <InvariantGlobalization>true</InvariantGlobalization>
    <SelfContained>true</SelfContained>
  </PropertyGroup>
</Project>
```
Example publish command:
```
dotnet publish -c Release -r win-x64
```
## The ABI contract
Before writing any code, define the contract. A workable contract for Python looks like this:
- exported functions use `cdecl`
- no managed exception is ever allowed to cross the native boundary
- object state is represented by opaque (void) pointers
- variable-sized results are allocated by the C# library and freed by a matching exported free function
- failures are reported by integer status codes, with error text retrievable through a separate API

The explicit `cdecl` is deliberate. `ctypes.CDLL` expects the standard C calling convention. Although x64 and ARM64 make `cdecl` and `stdcall` effectively interchangeable, we keep the calling convention explicit. `UnmanagedCallersOnly` also uses the default platform calling convention if `CallConvs` is omitted, so writing `CallConvCdecl` makes the boundary definition concrete instead of implicit.

## Error reporting across the boundary
The first rule of exported entry points is simple: do not throw. If an exception escapes an unmanaged boundary, you no longer have a well-defined interop contract. Every export should therefore be an exception barrier that converts failures into status codes and stores error text somewhere retrievable.

A single global error string is not good enough. It breaks immediately under concurrent calls. A better minimal design is thread-local error storage, which maps naturally to the way `ctypes.CDLL` releases the GIL and allows multiple Python threads to call into native code at once.

The following example uses a thread-local last-error buffer. A nice improvement over this example may address getting an error from a thread other than the one that made the failing call.
```c#
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;

public static unsafe class NativeApi
{
    [ThreadStatic]
    private static string? s_lastError;

    private static void ClearError() => s_lastError = null;

    private static void SetError(Exception ex) => s_lastError = ex.ToString();

    [UnmanagedCallersOnly(EntryPoint = "get_last_error_size", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static int GetLastErrorSize()
    {
        try
        {
            string s = s_lastError ?? string.Empty;
            return Encoding.UTF8.GetByteCount(s) + 1; // null terminator
        }
        catch
        {
            return 0;
        }
    }

    [UnmanagedCallersOnly(EntryPoint = "get_last_error_utf8", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static void GetLastErrorUtf8(byte* buffer, int bufferLen)
    {
        try
        {
            if (buffer == null || bufferLen <= 0)
                return;

            string s = s_lastError ?? string.Empty;
            byte[] utf8 = Encoding.UTF8.GetBytes(s);

            int written = Math.Min(utf8.Length, bufferLen - 1);
            for (int i = 0; i < written; i++)
                buffer[i] = utf8[i];

            buffer[written] = 0;
        }
        catch
        {
            // Never throw across the unmanaged boundary.
        }
    }
}
```

On the Python side:
```python
import ctypes as ct

lib = ct.CDLL(dll_path)

lib.get_last_error_size.restype = ct.c_int
lib.get_last_error_size.argtypes = []

lib.get_last_error_utf8.restype = None
lib.get_last_error_utf8.argtypes = [ct.c_void_p, ct.c_int]

def _last_error() -> str:
    n = lib.get_last_error_size()
    if n <= 1:
        return ""
    buf = ct.create_string_buffer(n)
    lib.get_last_error_utf8(buf, len(buf))
    return buf.value.decode("utf-8")
```
## Opaque handles for managed objects
Python must not receive raw pointers to managed objects. The runtime is free to move managed objects, and Python has no idea what their layout means anyway. The usual pattern is to allocate a `GCHandle`, convert it to an integer-sized opaque handle, which is fancy name for a void pointer, and pass that handle across the ABI. The native caller treats it as an opaque token and gives it back on later calls.

The important part is that the handle itself is the boundary object. It is not a pointer to the managed object. That distinction is what makes a normal `GCHandle` appropriate here.
```c#
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

public sealed class SomeObject
{
    public int[] DoWork()
    {
        // Real implementation omitted.
        return new[] { 1, 2, 3, 4 };
    }
}

public static unsafe class NativeApi
{
    private static nint MakeHandle(SomeObject obj) =>
        GCHandle.ToIntPtr(GCHandle.Alloc(obj, GCHandleType.Normal));

    private static SomeObject GetRequired(nint handle)
    {
        if (handle == 0)
            throw new ArgumentException("Handle is null.", nameof(handle));

        GCHandle gch = GCHandle.FromIntPtr(handle);

        if (gch.Target is not SomeObject obj)
            throw new InvalidOperationException("Invalid handle.");

        return obj;
    }

    [UnmanagedCallersOnly(EntryPoint = "create", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static nint Create()
    {
        try
        {
            SomeObject obj = new();
            ClearError();
            return MakeHandle(obj);
        }
        catch (Exception ex)
        {
            SetError(ex);
            return 0;
        }
    }

    [UnmanagedCallersOnly(EntryPoint = "destroy", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static int Destroy(nint handle)
    {
        try
        {
            if (handle == 0)
            {
                ClearError();
                return 0;
            }

            GCHandle gch = GCHandle.FromIntPtr(handle);
            gch.Free();

            ClearError();
            return 0;
        }
        catch (Exception ex)
        {
            SetError(ex);
            return -1;
        }
    }
}
```
Python binding:
```python
lib.create.restype = ct.c_void_p
lib.create.argtypes = []

lib.destroy.restype = ct.c_int
lib.destroy.argtypes = [ct.c_void_p]

def _check(status: int) -> None:
    if status != 0:
        raise RuntimeError(_last_error() or "Native call failed")

handle = lib.create()
if not handle:
    raise RuntimeError(_last_error() or "create() failed")
```
## Returning variable-sized results
The first nontrivial ABI case is caller-visible allocation: Python needs both a pointer and a length, and the C# library must also provide the matching deallocator. We do not return a borrowed pointer into managed memory. Also we do not assume Python can free memory allocated by some unrelated runtime. We instead allocate unmanaged memory in the C# library, return the pointer and element count, and export a matching free function from the same library. It is crucial that memory should be released by the same library that allocated it.

The implementation below does three things explicitly:
 - validates output pointers
 - zeroes outputs on failure
 - frees partially allocated memory in the catch path
 
Note that it still makes a room for double destroy and use after free. Additionally, `GCHandle.FromIntPtr(handle)` cannot validate that the handle is still valid or that it originated from its library.

```c#
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

public static unsafe class NativeApi
{
    [UnmanagedCallersOnly(EntryPoint = "do_work", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static int DoWork(nint handle, int** outResults, int* outCount)
    {
        int* results = null;

        try
        {
            if (outResults == null || outCount == null)
                throw new ArgumentNullException("Output pointers must be non-null.");

            *outResults = null;
            *outCount = 0;

            SomeObject obj = GetRequired(handle);
            int[] managed = obj.DoWork();

            int n = managed.Length;
            if (n == 0)
            {
                ClearError();
                return 0;
            }

            nuint bytes = checked((nuint)n * (nuint)sizeof(int));
            results = (int*)Marshal.AllocHGlobal((nint)bytes);

            for (int i = 0; i < n; i++)
                results[i] = managed[i];

            *outResults = results;
            *outCount = n;

            ClearError();
            return 0;
        }
        catch (Exception ex)
        {
            if (results != null)
                Marshal.FreeHGlobal((nint)results);

            if (outResults != null)
                *outResults = null;

            if (outCount != null)
                *outCount = 0;

            SetError(ex);
            return -1;
        }
    }

    [UnmanagedCallersOnly(EntryPoint = "free_results", CallConvs = new[] { typeof(CallConvCdecl) })]
    public static void FreeResults(void* resultsArray)
    {
        try
        {
            if (resultsArray != null)
                Marshal.FreeHGlobal((nint)resultsArray);
        }
        catch
        {
            // Never throw across the unmanaged boundary.
        }
    }
}
```

Python side:
```python
IntArrayPtr = ct.POINTER(ct.c_int)

lib.do_work.restype = ct.c_int
lib.do_work.argtypes = [
    ct.c_void_p,                # handle
    ct.POINTER(IntArrayPtr),    # outResults
    ct.POINTER(ct.c_int),       # outCount
]

lib.free_results.restype = None
lib.free_results.argtypes = [ct.c_void_p]

def do_work(handle: int) -> list[int]:
    results = IntArrayPtr()
    count = ct.c_int()

    _check(lib.do_work(handle, ct.byref(results), ct.byref(count)))

    try:
        if not results or count.value == 0:
            return []

        return [results[i] for i in range(count.value)]
    finally:
        if results:
            lib.free_results(ct.cast(results, ct.c_void_p))
```
A complete use site now looks like this:
```python
try:
    handle = lib.create()
    if not handle:
        raise RuntimeError(_last_error() or "create() failed")

    values = do_work(handle)
    print(values)
finally:
    if 'handle' in locals() and handle:
        _check(lib.destroy(handle))
```
## Concurrency and callbacks
This model works well for compute-oriented request/response APIs. It is less trivial when callbacks enter the stage. A plain `ctypes.CDLL` call releases the GIL while native code runs, which is exactly what you want for CPU-bound work. But if your native library later calls back into Python from a thread that Python did not create, `ctypes` will create a new dummy Python thread on each callback invocation. That behavior is correct, but it means thread-local Python state does not survive across those callback invocations in the way you would expect. If you need callbacks, design that path separately and conservatively.
## Open directions
The rules above may be considered (by me) dull, boring, and mechanical. That is a sign they should eventually be generated, not hand-written for every library.

A useful next step would be a binding tool for C# Native AOT that plays a role similar to nanobind in the C++ ecosystem. Such a tool could emit a wrapper around library with all necessary annotations and management policies.

The hard part is not producing a callable symbol. The hard part is making the generated inspectable, and difficult to misuse. A good generator should therefore treat ABI shape as the primary artifact, with both the C# exports and Python wrapper derived from the same contract.
## Conclusion
Using Native AOT C# as a Python-facing native library is entirely practical. The combination works because the two sides only meet at a C ABI boundary: Native AOT emits a self-contained shared library with exported entry points, and `ctypes` can load and call those exports directly. The hard part is not getting the first call to work. The hard part is defining a boundary that remains correct under failure, concurrency, and repeated use.

With a narrow ABI, C# becomes one more compiled implementation option behind a Python API. The hard part is not the call itself, it is preserving ownership, errors, and versioning across the boundary.