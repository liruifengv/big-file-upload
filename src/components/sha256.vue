<template>
  <div id="debug"></div>
  <input type="file" multiple @change="handleFileChange"/>
  <input type="file" @change="handleFolderChange" webkitdirectory/>
  <button @click="handleSplice">分片</button>
  <button @click="handleUpload">上传</button>
  <button @click="handleZip">打包</button>
  <div class="width"></div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { request } from '../common/request'
import { saveAs } from 'file-saver';

const CHUNK_SIZE = 4 * 1024 * 1024;

const count = ref(0)

const container = reactive({
  file: null,
  files: [],
})

const uploadFile = async (fileData) => {
 const res = await request({
    url: 'http://localhost:3000/api/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: fileData,
  })
  console.log('res:', res)
  return res.data
}

const handleUpload = () => {
  console.log('handleUpload:')
  const formData = new FormData();
  container.files.forEach(file => {
    formData.append("files", file);
  })
  uploadFile(formData)
  
  
  // const fileChunkList = createFileChunk(container.file)
  // const fileData = new FormData()
  // fileData.append('file', container.file)
  // uploadChunks(fileChunkList)
}



const uploadChunks = (fileChunkList) => {
  const requests = fileChunkList.map((item, index) => {
    console.log('item:', item)
    const formData = new FormData();
    formData.append("file", item.file);
    return uploadFile(formData);
  });

  Promise.all(requests).then((res) => {
    // mergeChunks('/mergeChunks', { size: DefualtChunkSize, filename: currFile.value.name });
    console.log('res:', res)
  }).catch((err) => {
    console.log('err:', err)
  })
}



const createFileChunk = (file, size = CHUNK_SIZE) => {
  const fileChunkList = [];
  let cur = 0;
  while (cur < file.size) {
    fileChunkList.push({ file: file.slice(cur, cur + size) });
    cur += size;
  }
  return fileChunkList;
}

const calculateHash = (fileChunkList) => {
  return new Promise((resolve, reject) => {
    container.worker = new Worker('/sha256.js');
    container.worker.postMessage({ fileChunkList });
    container.worker.onmessage = e => {
      const { hashs } = e.data;
      if(hashs) {
        resolve(hashs)
      }
    }
    // container.worker = new Worker('/test.js', {type: 'module'});
    // container.worker.postMessage(123);
  })
}

const handleSplice = async () => {
  console.log('handleSplice:')
  if(!container.file) return;
  const fileChunkList = createFileChunk(container.file)
  console.time()
  const fileHash = await calculateHash(fileChunkList)
  console.timeEnd()
  console.log('fileHash:', fileHash)
}

const handleFileChange = (e) => {
  const files = e.target.files;
  console.log('file:', files)
  container.files.push(...files)
}
const handleFolderChange = (e) => {
  const files = e.target.files;
  const arr = [...files]
  console.log('arr:', arr)

  container.files = arr
  console.log('file:', files)
}

const handleZip = async (e) => {
  console.log('handleZip:')
  let webkitRelativePath = container.files[0].webkitRelativePath;
  let zipFileName = webkitRelativePath.split("/")[0] + ".zip";
  console.log('开始打包:', zipFileName)
  console.time()
  let zipFile = await generateZipFile(zipFileName, container.files);
  console.timeEnd()
  console.log('打包结束:', zipFile)
  saveAs(zipFile, zipFileName);
}

const generateZipFile = (
  zipName, files,
  options = { type: "blob", compression: "DEFLATE", compressionOptions : {level:9} }
) => {
  return new Promise((resolve, reject) => {
    const zip = new JSZip();
    console.log('files:', files)
    for (let i = 0; i < files.length; i++) {
      const name = files[i].webkitRelativePath || files[i].name
      zip.file(name, files[i]);
    }
    zip.generateAsync(options).then(function (blob) {
      zipName = zipName || Date.now() + ".zip";
      const zipFile = new File([blob], zipName, {
        type: "application/zip",
      });
      resolve(zipFile);
    });
  });
}

</script>


<style scoped>
a {
  color: #42b983;
}
.width {
  width:2000px;
  min-width: 300px;
  max-width: 20px
}
</style>
