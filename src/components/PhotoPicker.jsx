import { useEffect, useRef, useState } from 'react'
import { compressImage } from '../lib/imageUtils'

export default function PhotoPicker({ onPhotoReady }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const uploadInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
  }

  async function openCamera() {
    setError('')

    // Mobile devices can continue using their native camera.
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      cameraInputRef.current?.click()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })

      streamRef.current = stream
      setCameraOpen(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 0)
    } catch (err) {
      setError('Could not access the camera. Please allow camera permission and try again.')
    }
  }

  async function handleFile(file) {
    if (!file) return

    setError('')
    setBusy(true)

    try {
      const compressedBlob = await compressImage(file)
      const url = URL.createObjectURL(compressedBlob)

      setPreviewUrl(url)
      onPhotoReady(compressedBlob)
    } catch (err) {
      setError('Could not process that photo. Try a different one.')
    } finally {
      setBusy(false)
    }
  }

  async function takePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(async (blob) => {
      if (blob) {
        await handleFile(blob)
      }
    }, 'image/jpeg', 0.9)

    stopCamera()
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="photo-picker">
      {cameraOpen ? (
        <div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 8,
            }}
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div
            className="photo-picker-actions"
            style={{ marginTop: 10 }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={takePhoto}
            >
              📸 Capture Photo
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={stopCamera}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Member preview"
              className="photo-preview"
            />
          ) : (
            <div className="photo-preview-empty">No photo yet</div>
          )}

          <div className="photo-picker-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={openCamera}
            >
              📸 Take Photo
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => uploadInputRef.current?.click()}
            >
              🖼️ Upload Photo
            </button>
          </div>
        </>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
