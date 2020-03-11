import * as tf from '@tensorflow/tfjs-node';
import { request as requestHTTPS } from 'https';
import { request as requestHTTP, IncomingMessage, ClientRequest } from 'http';

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
  classesURL: string;
  iou: string;
  minScore: string;
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
  payload: tf.Tensor[];
};

type NodeRedSendMessage = {
  payload: DetectedObject[];
};

type ImageClasses = {
  [index: string]: string;
};

type StatusOption = {
  fill?: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
  shape?: 'ring' | 'dot';
  text?: string;
};

/**
 * Wrapper function for http and https
 * @param url
 * @param callback
 */
function request(url: URL, callback?: (res: IncomingMessage) => void)
    : ClientRequest {

    const reqOpt = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'GET'
  };

  if (url.protocol === 'http:') {
    return requestHTTP(reqOpt, callback);
  } else if (url.protocol === 'https:') {
    return requestHTTPS(reqOpt, callback);
  }
  return undefined;
}

/**
 * Fetch Classes JSON doc
 * @param url file path, http url or https url. Need to contains
 *            the proper scheme, i.e. file:// or http://
 */
function fetchClasses(urlStr: string): Promise<ImageClasses> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch (e) {
    return Promise.reject('Invalid URL');
  }

  if (url.protocol === 'file:') {
    return Promise.resolve(require(url.pathname));
  }

  return new Promise<ImageClasses>((resolve, reject) => {
    const chunks: string[] = [];
    const req = request(url, (res: IncomingMessage) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(chunks.join('')));
        } else {
          reject(`can not fetch classes file: ${res.statusCode}, ${res.statusMessage}`);
        }
      });
    });

    if (req === undefined) {
      reject('unsupported protocol');
    } else {
      req.on('error', (e) => {
        reject(e.message);
      });
      req.end();
    }
  });
}

// Module for a Node-Red custom node
export = function init(RED: NodeRed) {

  class PostObjectDetection {
    // tslint:disable-next-line:no-any
    on: (event: string, fn: (msg: any) => void) => void;
    send: (msg: NodeRedSendMessage) => void;
    status: (option: StatusOption) => void;
    log: (msg: string) => void;
    getClassName: (idx: number) => string;

    classesURL: string;
    classes: ImageClasses;
    maxNumBoxes = 20;
    iou: number;
    minScore: number;

    constructor(config: NodeRedProperties) {
      this.classesURL = config.classesURL.trim();
      config.iou = config.iou || '0.5';
      config.minScore = config.minScore || '0.5';
      this.iou = parseFloat(config.iou);
      this.minScore = parseFloat(config.minScore);

      RED.nodes.createNode(this, config);
      this.on('input', (msg: NodeRedReceivedMessage) => {
        this.handleRequest(msg.payload);
      });

      this.on('close', (done: () => void) => {
        this.handleClose(done);
      });

      // By default, use id as the class name
      this.getClassName = (idx: number) => {
        return `${idx}`;
      };

      if (this.classesURL.length > 0) {
        fetchClasses(this.classesURL)
            .then((rev) => this.classes = rev)
            .then(() => {
              this.status({});
              this.getClassName = (idx: number) => {
                return this.classes[idx];
              };
            })
            .catch((error: string) => {
              this.log('can not fetch classes file, using id as class name instead');
              this.status({fill:'red' ,shape:'dot', text:error});
            });
      }
    }

    // Handle a single request
    // The following implementation is from:
    // https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/src/index.ts
    handleRequest(inputs: tf.Tensor[]) {
      const scores = inputs[0].dataSync() as Float32Array;
      const boxes = inputs[1].dataSync() as Float32Array;
      tf.dispose(inputs);
      const [maxScores, classes] =
        this.calculateMaxScores(scores, inputs[0].shape[1], inputs[0].shape[2]);
      const indexTensor = tf.tidy(() => {
        const boxes2 =
            tf.tensor2d(boxes, [inputs[1].shape[1], inputs[1].shape[3]]);
        return tf.image.nonMaxSuppression(
            boxes2, maxScores, this.maxNumBoxes, this.iou, this.minScore);
      });
      const indexes = indexTensor.dataSync() as Float32Array;
      indexTensor.dispose();

      const obj = this.buildDetectedObjects(
          boxes, maxScores, indexes, classes);
      this.send({payload: obj});
    }

    handleClose(done: () => void) {
      // node level clean up
      done();
    }

    buildDetectedObjects(boxes: Float32Array, scores: number[],
        indexes: Float32Array, classes: number[]): DetectedObject[] {
      const count = indexes.length;
      const objects: DetectedObject[] = [];
      for (let i = 0; i < count; i++) {
        const bbox = [
          boxes[indexes[i] * 4],
          boxes[indexes[i] * 4 + 1],
          boxes[indexes[i] * 4 + 2],
          boxes[indexes[i] * 4 + 3]
        ];

        objects.push({
          bbox: [bbox[1], bbox[0], bbox[3] - bbox[1], bbox[2] - bbox[0]],
          className: this.getClassName(classes[indexes[i]]),
          score: scores[indexes[i]]
        });
      }
      return objects;
    }

    calculateMaxScores(
        scores: Float32Array, numBoxes: number,
        numClasses: number): [number[], number[]] {
      const maxes = [];
      const classes = [];
      for (let i = 0; i < numBoxes; i++) {
        let max = Number.MIN_VALUE;
        let index = -1;
        for (let j = 0; j < numClasses; j++) {
          if (scores[i * numClasses + j] > max) {
            max = scores[i * numClasses + j];
            index = j;
          }
        }
        maxes[i] = max;
        classes[i] = index;
      }
      return [maxes, classes];
    }
  }

  RED.nodes.registerType('post-object-detection', PostObjectDetection);
};
