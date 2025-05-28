class ZCurve {
  constructor(point) {
    this.point = point;
    this.zIndex = this.getZCurveIndex(point.x, point.y);
  }

  // Spread bits of 16 bit integer to every second bit of a 32 bit integer
  spreadBits(number) {
    number &= 0xFFFF; // Ensure number is 16 bits
    number = (number | (number <<  8)) & 0x00FF00FF; // 8-bit gaps
    number = (number | (number <<  4)) & 0x0F0F0F0F; // 4-bit gaps
    number = (number | (number <<  2)) & 0x33333333; // 2-bit gaps
    number = (number | (number <<  1)) & 0x55555555; // 1-bit gaps
    return number;
  } 

  getZCurveIndex() {
    const xBits = this.spreaBits(this.point.x);
    const yBits = this.spreaBits(this.point.y);
    return (yBits << 1) | xBits;
  }
}

export class Quadtree {
  constructor(points) {
    const zPoints = points.map(point => ZCurve(point).zIndex); 
    zPoints.sort((a, b) => a - b);
  }


}