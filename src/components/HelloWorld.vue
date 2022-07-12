<template>
  <h1>{{ count }}</h1>
   <input type="file" @change="handleFileChange" />
  <button @click="handleUpload">分片</button>
  <button @click="normalUpload">普通上传</button>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { request } from '../common/request'

const CHUNK_SIZE = 4 * 1024 * 1024;

const count = ref(0)

const container = reactive({
  file: null
})

const normalUpload = async () => {
  if(!container.file) return;
  const fileData = new FormData()
  fileData.append('file', container.file)
  const res = await request({
    url: 'http://localhost:3000/api/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: fileData
  })
  console.log('res:', res)
}

const handleUpload = async () => {
  console.log('handleUpload:')
  if(!container.file) return;
  const fileChunkList = createFileChunk(container.file)
  console.log('fileChunkList:', fileChunkList)
  console.time()
  const fileHash = await calculateHash(fileChunkList)
  console.timeEnd()
  console.log('fileHash:', fileHash)
  // const res = await request({
  //   url: 'http://localhost:3000/api/check-hash',
  //   method: 'get',
  //   params: {
  //     fileHash: fileHash
  //   }
  // })

  const fileData = new FormData()
  fileData.append('file', container.file)
  const res = await request({
    url: 'http://localhost:3000/api/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: fileData,
    params: {
      fileHash: fileHash
    }
  })
  console.log('res:', res)
  
  // const dataList = fileChunkList.map(({file}, index) => ({
  //   chunk: file,
  //   hash: fileHash + '-' + index,
  //   fileName: container.file.name,
  //   fileHash: fileHash,
  // }))
  // console.log('dataList:', dataList)
}

const handleFileChange = (e) => {
  const [file] = e.target.files;
  console.log('file:', file)
  container.file = file
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
    container.worker = new Worker('/hash.js');
    container.worker.postMessage({ fileChunkList });
    container.worker.onmessage = e => {
      const { percentage, hash } = e.data;
      if(hash) {
        resolve(hash)
      }
    }
  })
}


</script>


<style scoped>
a {
  color: #42b983;
}
</style>
