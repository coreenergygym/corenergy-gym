// Resizes/compresses a photo in the browser before it's uploaded, so
// a phone's 4000x3000 camera photo doesn't turn into a multi-megabyte
// storage file. Returns a JPEG Blob.
export function compressImage(file, { maxDimension = 900, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (blob) resolve(blob)
          else reject(new Error('Could not process image'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image file'))
    }

    img.src = objectUrl
  })
}
