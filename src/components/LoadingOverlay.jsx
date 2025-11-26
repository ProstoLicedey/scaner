import './LoadingOverlay.css'

function LoadingOverlay({ message = 'Обработка изображения...' }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  )
}

export default LoadingOverlay

