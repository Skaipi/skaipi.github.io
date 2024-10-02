export class PriorityQueue {
  Element = class Element {
    constructor(element, priority) {
      this.element = element;
      this.priority = priority;
    }
  };

  constructor() {
    this.items = [];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  enqueue(element, priority) {
    const el = new this.Element(element, priority);
    this.items.push(el);
  }

  dequeue() {
    this.items.sort((a, b) => a.priority - b.priority);
    return this.isEmpty() ? null : this.items.pop().element;
  }

  remove(el) {
    let index = -1;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].element == el) {
        index = i;
        break;
      }
    }
    if (index < 0) return;
    this.items.splice(index, 1);
  }
}
