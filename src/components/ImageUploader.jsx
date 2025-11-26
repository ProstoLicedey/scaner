import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import './ImageUploader.css'

function ImageUploader({ onImageUpload }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      if (file.type.startsWith('image/')) {
        onImageUpload(file)
      }
    }
  }, [onImageUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  return (
    <div className="image-uploader">
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="upload-content">
          <svg
            className="upload-icon"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {isDragActive ? (
            <p className="upload-text">Отпустите файл здесь...</p>
          ) : (
            <>
              <p className="upload-text">
                Перетащите изображение сюда или нажмите для выбора
              </p>
              <p className="upload-hint">
                Поддерживаются форматы: JPG, PNG, WebP (макс. 10MB)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageUploader

