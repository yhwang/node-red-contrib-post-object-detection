# node-red-contrib-post-object-detection

This is a custom Node-RED node that handles the prediction results of an Object
Detection model.

## Installation

### Prerequisite
This module requires `@tensorflow/tfjs-node` as a peer dependency. You need
to install it within Node-RED manually.  TensorFlow.js on Node.js
([@tensorflow/tfjs-node](https://www.npmjs.com/package/@tensorflow/tfjs-node)
or
[@tensorflow/tfjs-node-gpu](https://www.npmjs.com/package/@tensorflow/tfjs-node-gpu)),
depend on the TensorFlow shared libraries. Putting TensorFlow.js as the
dependency of a custom Node-RED node may cause the situation where multiple
custom nodes each install their own `tfjs-node` module as a dependency. This causes
an attempt at loading multiple TensorFlow shared libraries in the same process, which
subsequently causes the process to abort with a protobuf assertion error.

Therefore, this module puts `@tensorflow/tfjs-node` as a peer dependency. You need
to install it with Node-RED manully.

Install `@tensorflow/tfjs-node`:
```
npm install @tensorflow/tfjs-node
```

This custom Node-RED node leverages the `node-canvas` npm package to draw the bounding
boxes on a image. Please make sure the platform running Node-RED fulfills the
prerequisites listed [here](https://www.npmjs.com/package/canvas#compiling). For
example, while using Ubuntu, you need to run the following command to install
the dependencies:
```
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### Install this module:
Once you install the peer dependency and the prerequisites, you can install this module:
```
npm install node-red-contrib-post-object-detection
```

## Usage

There are two custom Node-RED nodes in this package:
- `post-object-detection`: This is used to process the output of an Object Detection
  model.
- `bbox-image`: This is used to annotate an input original image with bounding boxes.

### `post-object-detection` node

The input for this node should be an array of `tf.Tensor` objects with a length of 2.
The first tensor in this array corresponds to the detected objects with a
`[1, number of box detectors, number of classes]` shape where `1` is the batch size.
The second tensor is the bounding boxes with a
`[1, number of box detectors, 1, 4]` shape where `4` is the four coordinates of the
box. This node also requires class information through the use of the `Class URL` property.
The file specified here should be a JSON file containing the `id` and `className`
for each class. For example:
```
{
    "0": "person",
    "1": "cup",
    ...
    ...
}
```
The following node properties can also be altered from the defaults:

- `IoU`: The intersection over union threshold for determining whether boxes overlap too much with
         respect to IOU during non-max suppression. Must be between [0, 1].
         Defaults to 0.5 (50% box overlap).
- `Min Score`: Minimum score needed for a box to be accepted during non-max suppression.
               Defaults to 0.5.

The node then calculates the object detection results and returns the detected
objects as an `Object[]`. Each object contains `bbox`, `className` and
`score` properties.
- `bbox`: The coordinates of the box, width and height: `[x, y, w, h]`.
          These values are float number between 0.0 and 1.0.
- `className`: The name of the class.
- `score`: The confidence value between 0.0 and 1.0.

### `bbox-image` node
The `msg.payload` passed to this node should be an object containing these two
properties:
- `image`: The image data in `Buffer` data type
- `objects`: An object array containing a list of detected objects.
             Each object has the following information:
  ```
  {
    bbox: [x, y, w, h],
    className: string,
    score: number
  }
  ```

This node annotates the image by drawing the bounding boxes of detected objects onto it.
This annotated image is then output as a `Buffer` for the next node.