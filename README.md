# node-red-contrib-post-object-detection

This is a custom Node-RED node that handles the prediction results of an Object
Detection model.

## Installation

### Prerequisite
For Tensorflow.js on Node.js
([@tensorflow/tfjs-node](https://www.npmjs.com/package/@tensorflow/tfjs-node)
or
[@tensorflow/tfjs-node-gpu](https://www.npmjs.com/package/@tensorflow/tfjs-node-gpu)),
it depends on Tensorflow shared libraries. Putting Tensorflow.js as the
dependency of custom Node-RED node may run into a situation that multiple
custom nodes install multiple `tfjs-node` module as their dependencies. While
loading multiple Tensorflow shared libraries in the same process, the process
would abord by hitting protobuf assertion.

Therefore, this module put `@tensorflow/tfjs-node` as peer dependency. You need
to install it with the Node-RED manully.

Install `@tensorflow/tfjs-node`:
```
npm install @tensorflow/tfjs-node
```

### Install this module:
Once you install the peer dependency, you can install this module:
```
npm install node-red-contrib-post-object-detection
```

## Usage

There are two custom Node-RED nodes in this package:
- post-object-detection: This is used to process the output of Object Detection
  model.
- bbox-image: This is used to annotate the original image with bounding boxes.

### `post-object-detection` node
The input for this node shall be an array of `tf.Tensorf` and its length is 2.
First tensor is the detected objects with
`[1, number of box detectors, number of classes]` shape. 1 is the batch size.
The second tensor is the bounding boxes with
`[1, number of box detectors, 1, 4]` shape. 4 is the four coordinates of the
box. It also needs classes information. Please use the `Class URL` to assign
a JSON file contains the `id` and `className` for each class. For example:
```json
{
    "0": "person",
    "1": "cup",
    ...
    ...
}
```
Then it calculates the object detection results and returns the detected
objects as an `Object[]`. Each object contains `bbox`, `className` and
`score` properties.
- bbox: the coordicates of the box, width and height: `[x, y, w, h]`.
  They are float number between 0.0 and 1.0.
- className: the name of the class
- score: the confident value between 0.0 and 1.0.

### `bbox-image` node
The `msg.payload` psssed to this node shall be an object and contains two
properties:
- image: the image data in Buffer data type.
- objects: an object array containing a list of detected objects.
  Each object has the following information:
  ```
  {
    bbox: [x, y, w, h],
    className: string,
    score: number
  }
  ```

This node annotates the bounding box of detected objects into the image and
sends to the next node as a Buffer.