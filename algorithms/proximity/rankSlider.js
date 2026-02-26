export class RankSlider {
  constructor(config) {
    this.id = "rankSlider";
    this.min = 0;
    this.max = 5;
    this.step = 1;
    this.value = config?.value ?? 1;

    this.render();
  }

  updateLabel() {
    this.labelEl.textContent = `Rank diff: ${this.value}`;
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
    this.inputEl.id = "rankThreshold";
    this.inputEl.name = "rankThreshold";
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
