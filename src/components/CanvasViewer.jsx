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
        // Показываем оригинальное изображение
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
        // Показываем обработанное изображение с фильтрами
        if (!(processedImage instanceof HTMLCanvasElement)) {
          setIsProcessing(false)
          return
        }

        canvas.width = processedImage.width
        canvas.height = processedImage.height

        // Получаем ImageData из canvas
        try {
          const sourceCtx = processedImage.getContext('2d')
          if (!sourceCtx) {
            throw new Error('Не удалось получить контекст из processedImage')
          }
          
          const imageData = sourceCtx.getImageData(
            0,
            0,
            processedImage.width,
            processedImage.height
          )

          // Применяем фильтры
          const filteredData = applyAllFilters(imageData, filters)

          // Рисуем на canvas
          ctx.putImageData(filteredData, 0, 0)
          
          // Проверяем, что canvas действительно содержит данные
          const verifyData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height))
          const hasData = verifyData.data.some((val, idx) => idx % 4 !== 3 && val !== 0)
          
          if (!hasData) {
            // Пробуем нарисовать напрямую
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(processedImage, 0, 0)
            const imageData2 = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const filteredData2 = applyAllFilters(imageData2, filters)
            ctx.putImageData(filteredData2, 0, 0)
          }
          
          setIsProcessing(false)
        } catch (error) {
          // Пробуем альтернативный метод
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(processedImage, 0, 0)
            
            // Проверяем, что что-то нарисовалось
            const checkData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height))
            const hasData = checkData.data.some((val, idx) => idx % 4 !== 3 && val !== 0)
            
            if (hasData) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const filteredData = applyAllFilters(imageData, filters)
              ctx.putImageData(filteredData, 0, 0)
            }
          } catch (altError) {
            // Игнорируем ошибки альтернативного метода
          }
          setIsProcessing(false)
        }
      }
    } catch (error) {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!canvasRef.current) return

    const link = document.createElement('a')
    link.download = 'processed-document.png'
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
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

