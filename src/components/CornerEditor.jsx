import { useState, useEffect, useRef } from 'react'
import { detectCorners } from '../utils/cornerDetection'
import { transformPerspectiveCanvas, calculateOptimalOutputSize } from '../utils/perspectiveTransform'
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

  if (!imageRef.current.complete || imageRef.current.naturalWidth === 0) {
    imageRef.current.onload = () => {
      detectCornersAutomatically()
    }
    return
  }

  setIsDetecting(true)
  try {
    if (typeof cv === 'undefined' || !cv.Mat || !cv.imread) {
      await loadOpenCV()
    }

    let detectedCorners
    try {
      detectedCorners = await detectCorners(imageRef.current)
    } catch (openCvError) {
      throw openCvError 
    }
    
    setCorners(detectedCorners)
    onCornersDetected?.(detectedCorners)
  } catch (error) {

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
      if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
        resolve()
        return
      }

      const existingScript = document.querySelector('script[src*="opencv"]')
      if (existingScript) {
        const checkInterval = setInterval(() => {
          if (typeof cv !== 'undefined' && cv.Mat && cv.imread) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Таймаут загрузки OpenCV.js'))
        }, 60000)
        return
      }

      const opencvSources = [
        'https://docs.opencv.org/4.8.0/opencv.js',
        'https://cdn.jsdelivr.net/npm/opencv-js@1.2.1/dist/opencv.js',
        'https://unpkg.com/opencv-js@1.2.1/dist/opencv.js'
      ]

      let sourceIndex = 0
      const tryLoadSource = () => {
        if (sourceIndex >= opencvSources.length) {
          reject(new Error('Не удалось загрузить OpenCV.js'))
          return
        }

        const script = document.createElement('script')
        script.src = opencvSources[sourceIndex]
        script.async = false
        script.type = 'text/javascript'

        script.onload = () => {
          if (cv && cv.onRuntimeInitialized) {
            cv.onRuntimeInitialized = () => {
              resolve()
            }
          } else {
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

    canvas.width = img.width
    canvas.height = img.height
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
      const optimalSize = calculateOptimalOutputSize(corners)
      const maxPreviewSize = 400
      const scale = Math.min(
        maxPreviewSize / optimalSize.width,
        maxPreviewSize / optimalSize.height
      )
      const previewWidth = Math.floor(optimalSize.width * scale)
      const previewHeight = Math.floor(optimalSize.height * scale)

      const transformedCanvas = await transformPerspectiveCanvas(
        imageRef.current,
        corners,
        optimalSize.width,
        optimalSize.height
      )
      const previewCtx = previewRef.current.getContext('2d')
      previewRef.current.width = previewWidth
      previewRef.current.height = previewHeight
      previewCtx.drawImage(transformedCanvas, 0, 0, previewWidth, previewHeight)
    } catch (error) {
      // Игнорируем ошибки превью
    }
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

    // Проверяем, кликнули ли на угол
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
      const optimalSize = calculateOptimalOutputSize(corners)
      const transformedCanvas = await transformPerspectiveCanvas(
        imageRef.current,
        corners,
        optimalSize.width,
        optimalSize.height
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
