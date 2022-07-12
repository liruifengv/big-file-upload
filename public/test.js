self.onmessage = function(event) {
  var i = event.data; 

  self.postMessage(i);
};