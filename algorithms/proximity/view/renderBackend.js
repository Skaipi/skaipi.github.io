export class BaseBackend {
  constructor(hostEl, colors) {
    this.hostEl = hostEl;
    this.colors = colors;
  }

  getSize() {
    const { width, height } = this.hostEl.getBoundingClientRect();
    return { width, height };
  }

  destroy() {
    this.hostEl.replaceChildren();
  }
}
