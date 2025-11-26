import { useState, useEffect, useRef } from 'react'
import { detectCorners, detectCornersSimple } from '../utils/cornerDetection'
import { transformPerspectiveCanvas } from '../utils/perspectiveTransform'
import LoadingOverlay from './LoadingOverlay'
import './CornerEditor.css'

function CornerEditor({ imageUrl, onCornersDetected, onCornersEdited, onTransformComplete }) {
  const [corners, setCorners] = useState(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [isTransforming, setIsTransforming] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => {
    if (imageUrl && !corners) {
      detectCornersAutomatically()
    }
  }, [imageUrl])

  useEffect(() => {
    if (corners && imageRef.current) {
      drawCanvas()
      updatePreview()
    }
  }, [corners])

  const detectCornersAutomatically = async () => {
    if (!imageRef.current) return

    // Ждем загрузки изображения
    if (!imageRef.current.complete || imageRef.current.naturalWidth === 0) {
      imageRef.current.onload = () => {
        detectCornersAutomatically()
      }
      return
    }

    setIsDetecting(true)
    try {
      // Загружаем OpenCV.js если еще не загружен
      if (typeof cv === 'undefined' || !cv.Mat || !cv.imread) {
        await loadOpenCV()
      }

      let detectedCorners
      try {
        detectedCorners = await detectCorners(imageRef.current)
      } catch (openCvError) {
        detectedCorners = await detectCornersSimple(imageRef.current)
      }
      setCorners(detectedCorners)
      onCornersDetected?.(detectedCorners)
    } catch (error) {
      // Устанавливаем углы по умолчанию
      const defaultCorners = [
        { x: 0, y: 0 },
        { x: imageRef.current.width, y: 0 },
        { x: imageRef.current.width, y: imageRef.current.height },
        { x: 0, y: imageRef.current.height }
      ]
      setCorners(defaultCorners)
      onCornersDetected?.(defaultCorners)
      alert('Не удалось автоматически определить углы документа. Используйте углы по умолчанию или настройте их вручную.')
    } finally {
      setIsDetecting(false)
    }
  }

  const loadOpenCV = () => {
    return new Promise((resolve, reject) => {
      // Проверяем, уже загружен ли OpenCV
      if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
        resolve()
        return
      }

      // Проверяем, не загружается ли уже
      const existingScript = document.querySelector('script[src*="opencv"]')
      if (existingScript) {
        // Ждем загрузки
        const checkInterval = setInterval(() => {
          if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Таймаут загрузки OpenCV.js'))
        }, 60000) // Увеличиваем таймаут до 60 секунд
        return
      }

      // Загружаем OpenCV.js с правильного CDN
      // Пробуем несколько источников
      const opencvSources = [
        'https://docs.opencv.org/4.8.0/opencv.js',
        'https://cdn.jsdelivr.net/npm/opencv-js@1.2.1/dist/opencv.js',
        'https://unpkg.com/opencv-js@1.2.1/dist/opencv.js'
      ]
      
      let sourceIndex = 0
      const tryLoadSource = () => {
        if (sourceIndex >= opencvSources.length) {
          reject(new Error('Не удалось загрузить OpenCV.js ни из одного источника'))
          return
        }
        
        const script = document.createElement('script')
        script.src = opencvSources[sourceIndex]
        script.async = false // Важно: не async для правильной инициализации
        script.type = 'text/javascript'
      
        script.onload = () => {
          // Ждем инициализации OpenCV
          if (cv && cv.onRuntimeInitialized) {
            cv.onRuntimeInitialized = () => {
              resolve()
            }
          } else {
            // Если onRuntimeInitialized уже был вызван
            const checkInit = setInterval(() => {
              if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
                clearInterval(checkInit)
                resolve()
              }
            }, 50)
            setTimeout(() => {
              clearInterval(checkInit)
              if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
                resolve()
              } else {
                // Пробуем следующий источник
                sourceIndex++
                tryLoadSource()
              }
            }, 5000)
          }
        }
        
        script.onerror = () => {
          sourceIndex++
          tryLoadSource()
        }
        
        document.head.appendChild(script)
      }
      
      tryLoadSource()
    })
  }

  const drawCanvas = () => {
    if (!canvasRef.current || !imageRef.current || !corners) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imageRef.current

    // Устанавливаем размеры canvas
    canvas.width = img.width
    canvas.height = img.height

    // Рисуем изображение
    ctx.drawImage(img, 0, 0)

    // Рисуем линии между углами
    ctx.strokeStyle = '#667eea'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y)
    }
    ctx.closePath()
    ctx.stroke()

    // Рисуем углы
    corners.forEach((corner, index) => {
      ctx.fillStyle = draggingIndex === index ? '#764ba2' : '#667eea'
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, 10, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  const updatePreview = async () => {
    if (!previewRef.current || !imageRef.current || !corners) return

    try {
      const transformedCanvas = await transformPerspectiveCanvas(
        imageRef.current,
        corners,
        400,
        500
      )
      const previewCtx = previewRef.current.getContext('2d')
      previewRef.current.width = transformedCanvas.width
      previewRef.current.height = transformedCanvas.height
      previewCtx.drawImage(transformedCanvas, 0, 0)
    } catch (error) {
      // Игнорируем ошибки превью
    }
  }

  const handleMouseDown = (e, index) => {
    setDraggingIndex(index)
  }

  const handleMouseMove = (e) => {
    if (draggingIndex === null || !canvasRef.current || !corners) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    const x = Math.max(0, Math.min(canvasRef.current.width, (e.clientX - rect.left) * scaleX))
    const y = Math.max(0, Math.min(canvasRef.current.height, (e.clientY - rect.top) * scaleY))

    const newCorners = [...corners]
    newCorners[draggingIndex] = { x, y }
    setCorners(newCorners)
    onCornersEdited?.(newCorners)
  }

  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !corners) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Проверяем, кликнули ли мы на угол
    const threshold = 20
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i]
      const distance = Math.sqrt(
        Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2)
      )
      if (distance < threshold) {
        setDraggingIndex(i)
        return
      }
    }
  }

  const handleMouseUp = () => {
    setDraggingIndex(null)
  }

  const handleApplyTransform = async () => {
    if (!imageRef.current || !corners) return

    setIsTransforming(true)
    try {
      // Вычисляем размеры выходного изображения на основе углов
      const width1 = Math.sqrt(
        Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)
      )
      const width2 = Math.sqrt(
        Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2)
      )
      const height1 = Math.sqrt(
        Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)
      )
      const height2 = Math.sqrt(
        Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2)
      )

      const outputWidth = Math.max(width1, width2)
      const outputHeight = Math.max(height1, height2)

      const transformedCanvas = await transformPerspectiveCanvas(
        imageRef.current,
        corners,
        outputWidth,
        outputHeight
      )
      
      onTransformComplete?.(transformedCanvas)
    } catch (error) {
      // Игнорируем ошибки трансформации
    } finally {
      setIsTransforming(false)
    }
  }

  if (!imageUrl) return null

  return (
    <div className="corner-editor">
      {(isDetecting || isTransforming) && (
        <LoadingOverlay
          message={isDetecting ? 'Определение углов документа...' : 'Применение трансформации...'}
        />
      )}
      <div className="editor-header">
        <h2>Редактирование углов документа</h2>
        <div className="editor-actions">
          <button
            onClick={detectCornersAutomatically}
            disabled={isDetecting}
            className="btn btn-secondary"
          >
            {isDetecting ? 'Определение...' : 'Авто-определение'}
          </button>
          <button
            onClick={handleApplyTransform}
            disabled={isTransforming}
            className="btn btn-primary"
          >
            {isTransforming ? 'Обработка...' : 'Применить трансформацию'}
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="canvas-container">
          <div className="canvas-wrapper">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Document"
              style={{ display: 'none' }}
              onLoad={() => {
                if (imageRef.current && !corners) {
                  detectCornersAutomatically()
                }
              }}
            />
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseDown={handleCanvasClick}
              className="editor-canvas"
            />
          </div>
          <p className="canvas-hint">
            Перетащите углы для корректировки границ документа
          </p>
        </div>

        <div className="preview-container">
          <h3>Предпросмотр</h3>
          <canvas ref={previewRef} className="preview-canvas" />
        </div>
      </div>
    </div>
  )
}

export default CornerEditor


