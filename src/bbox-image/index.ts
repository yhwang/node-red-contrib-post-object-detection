import { Image, createCanvas } from 'canvas';

const COLORS = ['Aqua', 'Coral', 'Cyan', 'Yellow', 'GreenYellow' ];

interface DetectedObject {
  bbox: [number, number, number, number];  // [x, y, width, height]
  className: string;
  score: number;
}

/**
 * Represent Node-Red's runtime
 */
type NodeRed = {
  nodes: NodeRedNodes;
};

type NodeRedWire = {
  [index: number]: string;
};

type NodeRedWires = {
  [index: number]: NodeRedWire;
};

/**
 * Represent Node-Red's configuration for a custom node
 * For this case, it's the configuration for tf-model node
 */
type NodeRedProperties = {
  id: string;
  type: string;
  name: string;
  wires: NodeRedWires;
};

/**
 * Represent Node-Red's nodes
 */
type NodeRedNodes = {
  // tslint:disable-next-line:no-any
  createNode(node: any, props: NodeRedProperties): void;
  // tslint:disable-next-line:no-any
  registerType(type: string, ctor: any): void;
};

/**
 * Represent Node-Red's message that passes to a node
 */
type NodeRedReceivedMessage = {
  payload: {
    image: Buffer;
    objects : DetectedObject[]
  };
};

type NodeRedSendMessage = {
  payload: Buffer;
};

type StatusOption = {
  fill?: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
  shape?: 'ring' | 'dot';
  text?: string;
};

/**
 * Sequentially use COLORS
 */
const getColor: () => string = function colorCounter() {
  let counter = 0;
  return () => {
    counter %= COLORS.length;
    return COLORS[counter++];
  };
}();

// Module for a Node-Red custom node
export = function init(RED: NodeRed) {

  class BBoxImage {
    // tslint:disable-next-line:no-any
    on: (event: string, fn: (msg: any) => void) => void;
    send: (msg: NodeRedSendMessage) => void;
    status: (option: StatusOption) => void;
    log: (msg: string) => void;
    error: (msg: string) => void;

    classesURL: string;
    maxNumBoxes = 20;

    constructor(config: NodeRedProperties) {

      RED.nodes.createNode(this, config);
      this.on('input', (msg: NodeRedReceivedMessage) => {
        this.handleRequest(msg.payload.image, msg.payload.objects);
      });

      this.on('close', (done: () => void) => {
        this.handleClose(done);
      });
    }

    // Handle a single request
    handleRequest(image: Buffer, objects: DetectedObject[]) {
      if (image === undefined || !Buffer.isBuffer(image) ||
          objects === undefined) {
        this.error('No image or objects in the msg.payload');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const imgBuff = this.drawBBox(img, objects);
        this.send({payload: imgBuff});
      };
      img.onerror = (err) => {
        this.error(err.message);
      };
      img.src = image;
    }

    handleClose(done: () => void) {
      // node level clean up
      done();
    }

    drawBBox(image: Image, objects: DetectedObject[]): Buffer {

      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      ctx.lineWidth = 2;

      objects.forEach((obj) => {
        const color = getColor();
        let [x, y, w, h] = obj.bbox;
        x = Math.round(x * image.width);
        w = Math.round(w * image.width);
        y = Math.round(y * image.height);
        h = Math.round(h * image.height);
        const txtMet = ctx.measureText(obj.className);
        let ty = y - 11;
        ty = ty < 0 ? 0 : ty;

        // draw the box
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        // draw the text box
        ctx.fillStyle = color;
        ctx.fillRect(x - 1, ty, txtMet.width + 4, 11);
        // draw the text and use default font: 10px sans-serif
        ctx.fillStyle = 'Black';
        ctx.fillText(obj.className,
            x + 1, 
            ty + Math.round(txtMet.emHeightAscent));
      });
      return canvas.toBuffer();
    }
  }

  RED.nodes.registerType('bbox-image', BBoxImage);
};
