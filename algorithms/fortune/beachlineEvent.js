/* *
 * This class implements beachline events, where recalculating of parobolas takes place
 */
export class BeachlineEvent {
  constructor(point, isSite = false) {
    this.point = point;
    this.isSite = isSite;
    this.arch = null;
    this.edge = null;
  }
}
