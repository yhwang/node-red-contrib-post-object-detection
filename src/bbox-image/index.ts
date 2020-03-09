import { Image, Canvas, CanvasRenderingContext2D, createCanvas } from 'canvas';

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
    image: string | Buffer;
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

// Module for a Node-Red custom node
export = function init(RED: NodeRed) {

  class BBoxImage {
    // tslint:disable-next-line:no-any
    on: (event: string, fn: (msg: any) => void) => void;
    send: (msg: NodeRedSendMessage) => void;
    status: (option: StatusOption) => void;
    log: (msg: string) => void;

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
    handleRequest(image: string | Buffer, objects: DetectedObject[]) {
      const img = new Image();
      let canvas: Canvas;
      let ctx: CanvasRenderingContext2D;
      img.onload = () => {
        canvas = createCanvas(img.width, img.height);
        ctx = canvas.getContext('2d');        
        this.drawBBox(ctx, img, objects);
        this.send({payload: canvas.toBuffer()});
      };
      img.onerror = (err) => {
        throw err;
      };
      img.src = image;
    }

    handleClose(done: () => void) {
      // node level clean up
      done();
    }

    drawBBox(ctx: CanvasRenderingContext2D, image: Image,
        objects: DetectedObject[]) {

      ctx.drawImage(image, 0, 0);
      ctx.lineWidth = 2;

      let counter = 0;
      objects.forEach((obj) => {
        // draw the box
        ctx.beginPath();
        ctx.strokeStyle = COLORS[counter];
        let [x1, y1, w, h] = obj.bbox;
        x1 = Math.round(x1 * image.width);
        w = Math.round(w * image.width);
        y1 = Math.round(y1 * image.height);
        h = Math.round(h * image.height);
        ctx.rect(x1, y1, w, h);
        ctx.stroke();
        // draw the text box
        const txtMet = ctx.measureText(obj.className);
        let ty = y1 - 11;
        ty = ty < 0 ? 0 : ty;
        // using default font: 10px sans-serif
        ctx.fillStyle = COLORS[counter];
        ctx.fillRect(x1 - 1, ty, txtMet.width + 4, 11);
        // draw the text
        ctx.fillStyle = 'Black';
        ctx.fillText(obj.className,
            x1 + 1, 
            ty + Math.round(txtMet.emHeightAscent));
        counter = ++counter % COLORS.length;
      });
    }
  }

  RED.nodes.registerType('bbox-image', BBoxImage);
};
