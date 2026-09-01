import { useRef, useState } from 'react'
import { compressImage } from '../lib/imageUtils'

// Two separate inputs power the two required buttons:
// - "Take Photo" uses capture="environment" so mobile browsers open the camera directly
// - "Upload Photo" opens the normal device file picker
// Both funnel through the same compression step before being handed to the parent.
export default function PhotoPicker({ onPhotoReady }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cameraInputRef = useRef(null)
  const uploadInputRef = useRef(null)

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

  return (
    <div className="photo-picker">
      {previewUrl ? (
        <img src={previewUrl} alt="Member preview" className="photo-preview" />
      ) : (
        <div className="photo-preview-empty">No photo yet</div>
      )}

      <div className="photo-picker-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => cameraInputRef.current?.click()}
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
