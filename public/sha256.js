// import sha256 from 'crypto-js/sha256';
async function sha256(data) {
  console.log('data:', data)
  
  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

self.onmessage = e => {
  const { fileChunkList } = e.data;
  console.log('fileChunkList:', fileChunkList)
  
  const hashs = []
  let count = 0;

  const loadNext = async (index) => {
    
    const reader = new FileReader(fileChunkList[index]);
    reader.readAsArrayBuffer(fileChunkList[index].file);
    reader.onload = async (e) => {
      count++;
      const hash = await sha256(e.target.result);
      console.log('hash:', hash)
      
      hashs.push(hash);
      if (count === fileChunkList.length) {
        self.postMessage({
          hashs: hashs
        })
      } else {
        loadNext(count);
      }
    }
  }
  loadNext(0);
}