export class KNNSlider {
  constructor(config) {
    this.id = "knnSlider";
    this.min = 1;
    this.max = 10;
    this.step = 1;
    this.value = config?.value ?? 5;

    this.render();
  }

  updateLabel() {
    this.labelEl.textContent = `K: ${this.value}`;
  }

  render() {
    this.root = document.getElementById("controls-panel");

    this.wrapper = document.createElement("div");
    this.wrapper.className = "range-input";

    this.labelEl = document.createElement("label");
    this.labelEl.setAttribute("for", this.id);
    this.updateLabel();
    this.wrapper.appendChild(this.labelEl);

    this.inputEl = document.createElement("input");
    this.inputEl.type = "range";
    this.inputEl.id = "knn";
    this.inputEl.name = "knn";
    this.inputEl.min = this.min;
    this.inputEl.max = this.max;
    this.inputEl.step = this.step;
    this.inputEl.value = this.value;

    this.inputEl.addEventListener("input", (e) => {
      this.value = Number(this.inputEl.value);
      this.updateLabel();
      if (this.onInput) this.onInput(this.value, e);
    });

    this.inputEl.addEventListener("change", (e) => {
      this.value = Number(this.inputEl.value);
      if (this.onChange) this.onChange(this.value, e);
    });

    this.wrapper.appendChild(this.inputEl);
    this.root.insertBefore(this.wrapper, this.root.childNodes[this.root.childNodes.length - 2]);
  }

  focus() {
    this.inputEl.focus();
  }
  destroy() {
    this.wrapper?.remove();
  }
}
