import { useState } from 'react'
import ImageUploader from './components/ImageUploader'
import CornerEditor from './components/CornerEditor'
import ImageFilters from './components/ImageFilters'
import CanvasViewer from './components/CanvasViewer'
import DownloadButton from './components/DownloadButton'
import './App.css'

function App() {
  const [image, setImage] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [corners, setCorners] = useState(null)
  const [processedImage, setProcessedImage] = useState(null)
  const [filters, setFilters] = useState({
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    saturation: 0,
    denoise: 0,
    temperature: 0,
    tint: 0,
    binarization: 0,
    whiteBackground: 0,
    textEnhancement: 0
  })
  const [step, setStep] = useState('upload') // upload, corners, filters, done

  const handleImageUpload = (file) => {
    const url = URL.createObjectURL(file)
    setImage(file)
    setImageUrl(url)
    setStep('corners')
  }

  const handleCornersDetected = (detectedCorners) => {
    setCorners(detectedCorners)
  }

  const handleCornersEdited = (editedCorners) => {
    setCorners(editedCorners)
  }

  const handleTransformComplete = (transformedImage) => {
    setProcessedImage(transformedImage)
    setStep('filters')
  }

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Document Scanner</h1>
        <p>Загрузите фото документа для обработки</p>
      </header>

      <main className="app-main">
        {step === 'upload' && (
          <ImageUploader onImageUpload={handleImageUpload} />
        )}

        {step === 'corners' && imageUrl && (
          <div className="step-container">
            <CornerEditor
              imageUrl={imageUrl}
              onCornersDetected={handleCornersDetected}
              onCornersEdited={handleCornersEdited}
              onTransformComplete={handleTransformComplete}
            />
          </div>
        )}

        {step === 'filters' && processedImage && (
          <div className="step-container">
            <div className="step-header">
              <button
                onClick={() => setStep('corners')}
                className="btn btn-back"
              >
                ← Вернуться к редактированию углов
              </button>
            </div>
            <div className="filters-layout">
              <CanvasViewer
                originalImage={imageUrl}
                processedImage={processedImage}
                filters={filters}
              />
              <ImageFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
              />
            </div>
            <DownloadButton
              processedImage={processedImage}
              filters={filters}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App

