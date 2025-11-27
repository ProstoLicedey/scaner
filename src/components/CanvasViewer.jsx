import { useEffect, useRef, useState } from 'react'
import { applyAllFilters } from '../utils/imageProcessing'
import LoadingOverlay from './LoadingOverlay'
import './CanvasViewer.css'

function CanvasViewer({ originalImage, processedImage, filters }) {
  const canvasRef = useRef(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (processedImage && canvasRef.current) {
      updateCanvas()
    }
  }, [processedImage, filters, showOriginal])

  const updateCanvas = async () => {
    if (!canvasRef.current || !processedImage) return

    setIsProcessing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    try {
      if (showOriginal && originalImage) {
        const img = new Image()
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
          setIsProcessing(false)
        }
        img.onerror = () => {
          setIsProcessing(false)
        }
        img.src = originalImage
      } else {
        if (!(processedImage instanceof HTMLCanvasElement)) {
          setIsProcessing(false)
          return
        }

        canvas.width = processedImage.width
        canvas.height = processedImage.height

        // Получаем ImageData и применяем фильтры
        const sourceCtx = processedImage.getContext('2d')
        if (!sourceCtx) {
          setIsProcessing(false)
          return
        }

        const imageData = sourceCtx.getImageData(0, 0, processedImage.width, processedImage.height)
        const filteredData = applyAllFilters(imageData, filters)
        ctx.putImageData(filteredData, 0, 0)

        setIsProcessing(false)
      }
    } catch (error) {
      setIsProcessing(false)
    }
  }

  return (
    <div className="canvas-viewer">
      {isProcessing && (
        <LoadingOverlay message="Применение фильтров к изображению..." />
      )}
      <div className="viewer-header">
        <h2>Результат обработки</h2>
        <div className="viewer-controls">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="btn btn-toggle"
          >
            {showOriginal ? 'Показать обработанное' : 'Показать оригинал'}
          </button>
        </div>
      </div>

      <div className="viewer-content">
        <div className="canvas-wrapper">
          <canvas ref={canvasRef} className="viewer-canvas" />
        </div>
      </div>
    </div>
  )
}

export default CanvasViewer
