const shell = require('shelljs');
const path = require('path');

// copy index.html to dist
['post-object-detection', 'bbox-image'].forEach((folder) => {
  shell.cp(
    path.join(__dirname, '..', 'src', folder, 'index.html'),
    path.join(__dirname, '..', 'dist', folder, 'index.html')
  );
});
