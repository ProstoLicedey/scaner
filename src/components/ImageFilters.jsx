import { useState, useEffect, useRef } from 'react'
import './ImageFilters.css'

function ImageFilters({ filters, onFiltersChange }) {
  const [localFilters, setLocalFilters] = useState(filters)
  const debounceTimerRef = useRef(null)
  const isInitialMount = useRef(true)

  // Синхронизируем локальное состояние с пропсами при изменении извне (кнопки)
  useEffect(() => {
    if (!isInitialMount.current) {
      setLocalFilters(filters)
    }
    isInitialMount.current = false
  }, [filters])

  const handleChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: parseFloat(value) }
    setLocalFilters(newFilters) // Обновляем UI сразу для плавности
    
    // Очищаем предыдущий таймер
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Применяем фильтры с задержкой 300ms после остановки движения слайдера
    debounceTimerRef.current = setTimeout(() => {
      onFiltersChange(newFilters)
    }, 300)
  }

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleAutoEnhance = () => {
    // Очищаем таймер дебаунсинга
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Автоматические значения для улучшения документов
    const autoFilters = {
      brightness: 5,
      contrast: 20,
      sharpness: 35,
      saturation: -30, // Убираем цвет для документов
      denoise: 15,
      temperature: 0,
      tint: 0,
      binarization: 0,
      whiteBackground: 40,
      textEnhancement: 50
    }
    setLocalFilters(autoFilters)
    onFiltersChange(autoFilters)
  }

  const handleDocumentMode = () => {
    // Очищаем таймер дебаунсинга
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Оптимальные настройки для документов A4 с текстом
    const documentFilters = {
      brightness: 0,
      contrast: 30,
      sharpness: 45,
      saturation: -80, // Почти черно-белое
      denoise: 20,
      temperature: 0,
      tint: 0,
      binarization: 60,
      whiteBackground: 60,
      textEnhancement: 70
    }
    setLocalFilters(documentFilters)
    onFiltersChange(documentFilters)
  }

  const handleReset = () => {
    // Очищаем таймер дебаунсинга
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    const resetFilters = {
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
    }
    setLocalFilters(resetFilters)
    onFiltersChange(resetFilters)
  }

  return (
    <div className="image-filters">
      <div className="filters-header">
        <h2>Фильтры изображения</h2>
        <div className="filter-actions">
          <button onClick={handleAutoEnhance} className="btn btn-auto">
            Авто-улучшение
          </button>
          <button onClick={handleDocumentMode} className="btn btn-document">
            Режим документа
          </button>
          <button onClick={handleReset} className="btn btn-reset">
            Сброс
          </button>
        </div>
      </div>

      <div className="filters-list">
        <div className="filter-item">
          <label>
            <span>Яркость</span>
            <span className="filter-value">{localFilters.brightness}%</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={localFilters.brightness}
            onChange={(e) => handleChange('brightness', e.target.value)}
            className="filter-slider"
          />
        </div>

        <div className="filter-item">
          <label>
            <span>Контраст</span>
            <span className="filter-value">{localFilters.contrast}%</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={localFilters.contrast}
            onChange={(e) => handleChange('contrast', e.target.value)}
            className="filter-slider"
          />
        </div>

        <div className="filter-item">
          <label>
            <span>Резкость</span>
            <span className="filter-value">{localFilters.sharpness}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={localFilters.sharpness}
            onChange={(e) => handleChange('sharpness', e.target.value)}
            className="filter-slider"
          />
        </div>

        <div className="filter-item">
          <label>
            <span>Насыщенность</span>
            <span className="filter-value">{localFilters.saturation}%</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={localFilters.saturation}
            onChange={(e) => handleChange('saturation', e.target.value)}
            className="filter-slider"
          />
        </div>

        <div className="filter-item">
          <label>
            <span>Шумоподавление</span>
            <span className="filter-value">{localFilters.denoise}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localFilters.denoise}
            onChange={(e) => handleChange('denoise', e.target.value)}
            className="filter-slider"
          />
        </div>

        <div className="filter-item">
          <label>
            <span>Температура цвета</span>
            <span className="filter-value">{localFilters.temperature}%</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={localFilters.temperature}
            onChange={(e) => handleChange('temperature', e.target.value)}
            className="filter-slider"
          />
          <div className="filter-hint">-100 (холодный) → +100 (теплый)</div>
        </div>

        <div className="filter-item">
          <label>
            <span>Оттенок</span>
            <span className="filter-value">{localFilters.tint}%</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={localFilters.tint}
            onChange={(e) => handleChange('tint', e.target.value)}
            className="filter-slider"
          />
          <div className="filter-hint">-100 (пурпурный) → +100 (зеленый)</div>
        </div>

        <div className="filter-item">
          <label>
            <span>Бинаризация</span>
            <span className="filter-value">{localFilters.binarization}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localFilters.binarization}
            onChange={(e) => handleChange('binarization', e.target.value)}
            className="filter-slider"
          />
          <div className="filter-hint">Черно-белое преобразование для текстовых документов</div>
        </div>

        <div className="filter-item">
          <label>
            <span>Белый фон</span>
            <span className="filter-value">{localFilters.whiteBackground}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localFilters.whiteBackground}
            onChange={(e) => handleChange('whiteBackground', e.target.value)}
            className="filter-slider"
          />
          <div className="filter-hint">Осветление фона документа</div>
        </div>

        <div className="filter-item">
          <label>
            <span>Улучшение текста</span>
            <span className="filter-value">{localFilters.textEnhancement}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={localFilters.textEnhancement}
            onChange={(e) => handleChange('textEnhancement', e.target.value)}
            className="filter-slider"
          />
          <div className="filter-hint">Адаптивное улучшение контраста текста</div>
        </div>
      </div>
    </div>
  )
}

export default ImageFilters

