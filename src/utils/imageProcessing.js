/**
 * Функции обработки изображения
 */

/**
 * Применяет коррекцию яркости
 */
export function applyBrightness(imageData, value) {
  const data = new Uint8ClampedArray(imageData.data)
  const factor = value / 100

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] + factor * 255)) // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + factor * 255)) // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + factor * 255)) // B
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Применяет коррекцию контраста
 */
export function applyContrast(imageData, value) {
  const data = new Uint8ClampedArray(imageData.data)
  const factor = (259 * (value + 255)) / (255 * (259 - value))

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128)) // R
    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128)) // G
    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128)) // B
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Применяет повышение резкости (unsharp mask)
 */
export function applySharpness(imageData, value) {
  if (value === 0) return imageData

  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const strength = value / 100

  // Создаем копию для применения фильтра
  const original = new Uint8ClampedArray(imageData.data)

  // Применяем unsharp mask
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c

        // Вычисляем лапласиан (вторую производную)
        const laplacian =
          -original[idx] +
          (original[((y - 1) * width + x) * 4 + c] +
            original[((y + 1) * width + x) * 4 + c] +
            original[(y * width + x - 1) * 4 + c] +
            original[(y * width + x + 1) * 4 + c]) /
            4

        // Применяем unsharp mask
        data[idx] = Math.min(
          255,
          Math.max(0, original[idx] + strength * laplacian)
        )
      }
    }
  }

  return new ImageData(data, width, height)
}

/**
 * Применяет коррекцию насыщенности
 */
export function applySaturation(imageData, value) {
  const data = new Uint8ClampedArray(imageData.data)
  const factor = value / 100

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Преобразуем в grayscale для вычисления насыщенности
    const gray = 0.299 * r + 0.587 * g + 0.114 * b

    data[i] = Math.min(255, Math.max(0, gray + (r - gray) * (1 + factor))) // R
    data[i + 1] = Math.min(255, Math.max(0, gray + (g - gray) * (1 + factor))) // G
    data[i + 2] = Math.min(255, Math.max(0, gray + (b - gray) * (1 + factor))) // B
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Применяет шумоподавление (медианный фильтр)
 */
export function applyDenoise(imageData, value) {
  if (value === 0) return imageData

  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const original = new Uint8ClampedArray(imageData.data)
  const radius = Math.floor((value / 100) * 2) // радиус от 0 до 2

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) {
        const values = []

        // Собираем значения в окрестности
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = ((y + dy) * width + x + dx) * 4 + c
            values.push(original[idx])
          }
        }

        // Медианный фильтр
        values.sort((a, b) => a - b)
        const median = values[Math.floor(values.length / 2)]
        const idx = (y * width + x) * 4 + c
        data[idx] = median
      }
    }
  }

  return new ImageData(data, width, height)
}

/**
 * Применяет коррекцию цвета (температура и оттенок)
 */
export function applyColorCorrection(imageData, temperature, tint) {
  const data = new Uint8ClampedArray(imageData.data)

  // Преобразуем температуру в коэффициенты RGB
  // Температура: -100 (холодный/синий) до +100 (теплый/желтый)
  const tempFactor = temperature / 100
  const tintFactor = tint / 100

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Коррекция температуры
    if (tempFactor > 0) {
      // Теплее (больше красного и желтого)
      r = Math.min(255, r + tempFactor * 30)
      b = Math.max(0, b - tempFactor * 30)
    } else {
      // Холоднее (больше синего)
      r = Math.max(0, r + tempFactor * 30)
      b = Math.min(255, b - tempFactor * 30)
    }

    // Коррекция оттенка (зеленый/пурпурный)
    if (tintFactor > 0) {
      // Больше зеленого
      g = Math.min(255, g + tintFactor * 20)
      r = Math.max(0, r - tintFactor * 10)
      b = Math.max(0, b - tintFactor * 10)
    } else {
      // Больше пурпурного
      g = Math.max(0, g + tintFactor * 20)
      r = Math.min(255, r - tintFactor * 10)
      b = Math.min(255, b - tintFactor * 10)
    }

    data[i] = Math.round(r)
    data[i + 1] = Math.round(g)
    data[i + 2] = Math.round(b)
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Автоматическое улучшение изображения
 */
export function autoEnhance(imageData) {
  let result = imageData

  // Автоматическая коррекция яркости и контраста
  const brightness = calculateAutoBrightness(result)
  result = applyBrightness(result, brightness)

  const contrast = calculateAutoContrast(result)
  result = applyContrast(result, contrast)

  // Легкое повышение резкости
  result = applySharpness(result, 20)

  // Легкое повышение насыщенности
  result = applySaturation(result, 10)

  // Легкое шумоподавление
  result = applyDenoise(result, 15)

  return result
}

/**
 * Вычисляет оптимальную яркость для авто-коррекции
 */
function calculateAutoBrightness(imageData) {
  let sum = 0
  let count = 0

  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray =
      0.299 * imageData.data[i] +
      0.587 * imageData.data[i + 1] +
      0.114 * imageData.data[i + 2]
    sum += gray
    count++
  }

  const avg = sum / count
  // Целевая яркость - 128 (середина)
  return ((128 - avg) / 128) * 50 // Нормализуем до диапазона -50 до +50
}

/**
 * Вычисляет оптимальный контраст для авто-коррекции
 */
function calculateAutoContrast(imageData) {
  let min = 255
  let max = 0

  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray =
      0.299 * imageData.data[i] +
      0.587 * imageData.data[i + 1] +
      0.114 * imageData.data[i + 2]
    min = Math.min(min, gray)
    max = Math.max(max, gray)
  }

  // Растягиваем контраст
  const range = max - min
  if (range < 50) {
    // Низкий контраст - увеличиваем
    return Math.min(50, (50 - range) / 2)
  }

  return 0
}

/**
 * Применяет бинаризацию (черно-белое преобразование) для документов
 */
export function applyBinarization(imageData, value) {
  if (value === 0) return imageData

  const strength = value / 100
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height

  // Вычисляем глобальный порог (метод Оцу)
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    histogram[gray]++
  }

  // Метод Оцу для определения оптимального порога
  let total = width * height
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i]
  }

  let sumB = 0
  let wB = 0
  let wF = 0
  let maxVariance = 0
  let threshold = 128

  for (let i = 0; i < 256; i++) {
    wB += histogram[i]
    if (wB === 0) continue
    wF = total - wB
    if (wF === 0) break

    sumB += i * histogram[i]
    let mB = sumB / wB
    let mF = (sum - sumB) / wF
    let variance = wB * wF * (mB - mF) * (mB - mF)

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = i
    }
  }

  // Применяем бинаризацию с настраиваемой силой
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    const binaryValue = gray > threshold ? 255 : 0

    // Смешиваем оригинальный цвет с бинаризованным
    const r = Math.round(data[i] * (1 - strength) + binaryValue * strength)
    const g = Math.round(data[i + 1] * (1 - strength) + binaryValue * strength)
    const b = Math.round(data[i + 2] * (1 - strength) + binaryValue * strength)

    data[i] = Math.min(255, Math.max(0, r))
    data[i + 1] = Math.min(255, Math.max(0, g))
    data[i + 2] = Math.min(255, Math.max(0, b))
  }

  return new ImageData(data, width, height)
}

/**
 * Улучшает белый фон документа (оптимизированная версия)
 */
export function applyWhiteBackground(imageData, value) {
  if (value === 0) return imageData

  const strength = value / 100
  const data = new Uint8ClampedArray(imageData.data)

  // Используем гистограмму для быстрого определения порога фона
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)
    histogram[brightness]++
  }

  // Находим порог, при котором накапливается 90% самых ярких пикселей
  let cumulative = 0
  const targetPixels = Math.floor((data.length / 4) * 0.1)
  let backgroundThreshold = 200 // значение по умолчанию

  for (let i = 255; i >= 0; i--) {
    cumulative += histogram[i]
    if (cumulative >= targetPixels) {
      backgroundThreshold = i
      break
    }
  }

  // Осветляем пиксели, которые близки к фону
  const thresholdLow = backgroundThreshold * 0.8
  const thresholdRange = backgroundThreshold * 0.2

  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3

    if (brightness > thresholdLow) {
      // Это фон - делаем его белее
      const factor = Math.min(1, (brightness - thresholdLow) / thresholdRange)
      const whiteBoost = strength * factor * (255 - brightness)

      data[i] = Math.min(255, data[i] + whiteBoost)
      data[i + 1] = Math.min(255, data[i + 1] + whiteBoost)
      data[i + 2] = Math.min(255, data[i + 2] + whiteBoost)
    }
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Улучшение текста - упрощенная и быстрая версия
 */
export function applyTextEnhancement(imageData, value) {
  if (value === 0) return imageData

  const strength = value / 100
  const data = new Uint8ClampedArray(imageData.data)
  const width = imageData.width
  const height = imageData.height
  const original = new Uint8ClampedArray(imageData.data)

  // Конвертируем в grayscale для анализа
  const grayscale = new Uint8ClampedArray(width * height)
  for (let i = 0; i < data.length; i += 4) {
    grayscale[i / 4] = Math.round(0.299 * original[i] + 0.587 * original[i + 1] + 0.114 * original[i + 2])
  }

  // Вычисляем глобальное среднее для быстрой оценки
  let globalSum = 0
  for (let i = 0; i < grayscale.length; i++) {
    globalSum += grayscale[i]
  }
  const globalMean = globalSum / grayscale.length

  // Используем упрощенный алгоритм: локальное среднее только для каждого N-го пикселя
  const step = Math.max(4, Math.floor(Math.min(width, height) / 50)) // Обрабатываем каждый 4-50-й пиксель
  const blockSize = 9 // Небольшой фиксированный размер блока
  const halfBlock = Math.floor(blockSize / 2)

  // Создаем массив локальных средних (разреженный)
  const localMeans = new Float32Array(width * height)
  
  // Вычисляем локальные средние только для каждого step-го пикселя
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      let sum = 0
      let count = 0

      for (let dy = -halfBlock; dy <= halfBlock; dy++) {
        for (let dx = -halfBlock; dx <= halfBlock; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx))
          const ny = Math.max(0, Math.min(height - 1, y + dy))
          sum += grayscale[ny * width + nx]
          count++
        }
      }

      localMeans[y * width + x] = sum / count
    }
  }

  // Применяем улучшение, используя интерполяцию между ближайшими вычисленными значениями
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const gray = grayscale[y * width + x]

      // Находим ближайшие вычисленные средние (4 угла)
      const x1 = Math.floor(x / step) * step
      const x2 = Math.min(width - 1, x1 + step)
      const y1 = Math.floor(y / step) * step
      const y2 = Math.min(height - 1, y1 + step)

      // Билинейная интерполяция
      const mean = (localMeans[y1 * width + x1] || globalMean) * 
                   ((x2 - x) / step) * ((y2 - y) / step) +
                   (localMeans[y1 * width + x2] || globalMean) * 
                   ((x - x1) / step) * ((y2 - y) / step) +
                   (localMeans[y2 * width + x1] || globalMean) * 
                   ((x2 - x) / step) * ((y - y1) / step) +
                   (localMeans[y2 * width + x2] || globalMean) * 
                   ((x - x1) / step) * ((y - y1) / step)

      const diff = Math.abs(gray - mean)

      // Усиливаем контраст в областях с вариацией (текст)
      if (diff > 20) {
        const contrastFactor = 1 + strength * 0.5
        const threshold = mean

        let newGray
        if (gray > threshold) {
          newGray = Math.min(255, threshold + (gray - threshold) * contrastFactor)
        } else {
          newGray = Math.max(0, threshold - (threshold - gray) * contrastFactor)
        }

        const factor = newGray / (gray || 1)
        data[idx] = Math.min(255, Math.max(0, original[idx] * factor))
        data[idx + 1] = Math.min(255, Math.max(0, original[idx + 1] * factor))
        data[idx + 2] = Math.min(255, Math.max(0, original[idx + 2] * factor))
      } else if (gray > 200) {
        // Однородная область (фон) - слегка осветляем
        const lightenFactor = 1 + strength * 0.2
        data[idx] = Math.min(255, original[idx] * lightenFactor)
        data[idx + 1] = Math.min(255, original[idx + 1] * lightenFactor)
        data[idx + 2] = Math.min(255, original[idx + 2] * lightenFactor)
      }
    }
  }

  return new ImageData(data, width, height)
}

/**
 * Применяет все фильтры к изображению
 */
export function applyAllFilters(imageData, filters) {
  let result = imageData

  // Сначала применяем базовые фильтры
  if (filters.brightness !== 0) {
    result = applyBrightness(result, filters.brightness)
  }

  if (filters.contrast !== 0) {
    result = applyContrast(result, filters.contrast)
  }

  if (filters.sharpness !== 0) {
    result = applySharpness(result, filters.sharpness)
  }

  if (filters.saturation !== 0) {
    result = applySaturation(result, filters.saturation)
  }

  if (filters.denoise !== 0) {
    result = applyDenoise(result, filters.denoise)
  }

  if (filters.temperature !== 0 || filters.tint !== 0) {
    result = applyColorCorrection(result, filters.temperature, filters.tint)
  }

  // Затем применяем специальные фильтры для документов
  if (filters.whiteBackground !== 0) {
    result = applyWhiteBackground(result, filters.whiteBackground)
  }

  if (filters.textEnhancement !== 0) {
    result = applyTextEnhancement(result, filters.textEnhancement)
  }

  if (filters.binarization !== 0) {
    result = applyBinarization(result, filters.binarization)
  }

  return result
}

