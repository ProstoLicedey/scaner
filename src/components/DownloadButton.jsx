import { useRef } from 'react'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { applyAllFilters } from '../utils/imageProcessing'
import './DownloadButton.css'

function DownloadButton({ processedImage, filters }) {
  const canvasRef = useRef(null)

  const prepareCanvas = () => {
    if (!processedImage) return null

    const canvas = document.createElement('canvas')
    canvas.width = processedImage.width
    canvas.height = processedImage.height
    const ctx = canvas.getContext('2d')

    // Получаем ImageData
    const imageData = processedImage.getContext('2d').getImageData(
      0,
      0,
      processedImage.width,
      processedImage.height
    )

    // Применяем фильтры
    const filteredData = applyAllFilters(imageData, filters)

    // Рисуем на canvas
    ctx.putImageData(filteredData, 0, 0)

    return canvas
  }

  const handleDownloadPNG = () => {
    const canvas = prepareCanvas()
    if (!canvas) return

    canvas.toBlob((blob) => {
      saveAs(blob, 'document-scanned.png')
    }, 'image/png')
  }

  const handleDownloadJPG = () => {
    const canvas = prepareCanvas()
    if (!canvas) return

    canvas.toBlob(
      (blob) => {
        saveAs(blob, 'document-scanned.jpg')
      },
      'image/jpeg',
      0.95
    )
  }

  const handleDownloadPDF = () => {
    const canvas = prepareCanvas()
    if (!canvas) return

    // Получаем данные изображения
    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    // Создаем PDF
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    })

    // Добавляем изображение в PDF
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
    pdf.save('document-scanned.pdf')
  }

  if (!processedImage) return null

  return (
    <div className="download-button">
      <h3>Скачать результат</h3>
      <div className="download-options">
        <button onClick={handleDownloadPNG} className="btn btn-download">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PNG
        </button>
        <button onClick={handleDownloadJPG} className="btn btn-download">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          JPG
        </button>
        <button onClick={handleDownloadPDF} className="btn btn-download">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          PDF
        </button>
      </div>
    </div>
  )
}

export default DownloadButton

