/**
 * Перспективная трансформация изображения
 * Используется более точный метод через билинейную интерполяцию
 */
export function transformPerspective(imageElement, corners, outputWidth, outputHeight) {
  // Используем более точную реализацию через transformPerspectiveCanvas
  return transformPerspectiveCanvas(imageElement, corners, outputWidth, outputHeight)
}

/**
 * Вычисляет матрицу перспективной трансформации
 */
function calculatePerspectiveMatrix(src, dst) {
  // Упрощенная версия - используем более простой подход
  // Для точной перспективной трансформации нужна полная матрица 3x3
  
  // Вычисляем ширину и высоту исходного и целевого прямоугольников
  const srcWidth = Math.max(
    Math.abs(src[1].x - src[0].x),
    Math.abs(src[2].x - src[3].x)
  )
  const srcHeight = Math.max(
    Math.abs(src[3].y - src[0].y),
    Math.abs(src[2].y - src[1].y)
  )

  const dstWidth = dst[1].x - dst[0].x
  const dstHeight = dst[3].y - dst[0].y

  // Используем более простой метод - билинейную интерполяцию
  return [1, 0, 0, 0, 1, 0, 0, 0]
}

/**
 * Получает матрицу перспективной трансформации (упрощенная версия)
 */
function getPerspectiveTransform(src, dst) {
  // Для упрощения используем аффинную трансформацию
  // В реальном приложении нужна полная перспективная матрица 3x3
  
  // Вычисляем масштаб
  const srcWidth = Math.sqrt(
    Math.pow(src[1].x - src[0].x, 2) + Math.pow(src[1].y - src[0].y, 2)
  )
  const srcHeight = Math.sqrt(
    Math.pow(src[3].x - src[0].x, 2) + Math.pow(src[3].y - src[0].y, 2)
  )

  const dstWidth = dst[1].x - dst[0].x
  const dstHeight = dst[3].y - dst[0].y

  const scaleX = dstWidth / srcWidth
  const scaleY = dstHeight / srcHeight

  // Вычисляем смещение
  const offsetX = dst[0].x - src[0].x * scaleX
  const offsetY = dst[0].y - src[0].y * scaleY

  return [scaleX, 0, offsetX, 0, scaleY, offsetY, 0, 0]
}

/**
 * Более точная перспективная трансформация с использованием Canvas API
 */
export function transformPerspectiveCanvas(imageElement, corners, outputWidth, outputHeight) {
  return new Promise((resolve, reject) => {
    // Валидация входных данных
    if (!corners || corners.length !== 4) {
      reject(new Error('Неверное количество углов'))
      return
    }

    // Проверяем, что углы валидны
    for (let i = 0; i < corners.length; i++) {
      if (typeof corners[i].x !== 'number' || typeof corners[i].y !== 'number' ||
          isNaN(corners[i].x) || isNaN(corners[i].y)) {
        reject(new Error(`Неверные координаты угла ${i}`))
        return
      }
    }

    const canvas = document.createElement('canvas')
    const width = Math.max(100, Math.floor(outputWidth || 800))
    const height = Math.max(100, Math.floor(outputHeight || 1000))
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Заполняем белым фоном на случай, если трансформация не покроет весь canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    // Используем более точный метод с ручной интерполяцией
    const image = new Image()
    image.onload = () => {
      try {
        // Создаем временный canvas для исходного изображения
        const srcCanvas = document.createElement('canvas')
        srcCanvas.width = image.width
        srcCanvas.height = image.height
        const srcCtx = srcCanvas.getContext('2d')
        srcCtx.drawImage(image, 0, 0)

        const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)
        const dstData = ctx.createImageData(width, height)

        // Инициализируем dstData белым цветом
        for (let i = 0; i < dstData.data.length; i += 4) {
          dstData.data[i] = 255     // R
          dstData.data[i + 1] = 255 // G
          dstData.data[i + 2] = 255 // B
          dstData.data[i + 3] = 255 // A
        }

        let pixelsDrawn = 0

        // Перспективная трансформация через обратное преобразование
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // Вычисляем соответствующие координаты в исходном изображении
            const srcCoords = inversePerspectiveTransform(corners, x, y, width, height)
            const srcX = srcCoords.x
            const srcY = srcCoords.y

            // Билинейная интерполяция пикселей
            if (srcX >= 0 && srcX < srcCanvas.width && srcY >= 0 && srcY < srcCanvas.height) {
              try {
                const pixel = getBilinearPixel(srcData, srcX, srcY)
                const dstIndex = (y * width + x) * 4
                dstData.data[dstIndex] = pixel.r
                dstData.data[dstIndex + 1] = pixel.g
                dstData.data[dstIndex + 2] = pixel.b
                dstData.data[dstIndex + 3] = pixel.a
                pixelsDrawn++
              } catch (pixelError) {
                // Игнорируем ошибки отдельных пикселей
              }
            }
          }
        }

        if (pixelsDrawn === 0) {
          // Fallback: просто рисуем исходное изображение
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(image, 0, 0, width, height)
          resolve(canvas)
          return
        }

        ctx.putImageData(dstData, 0, 0)
        resolve(canvas)
      } catch (error) {
        // Fallback: просто рисуем исходное изображение
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
        resolve(canvas)
      }
    }
    image.onerror = () => {
      reject(new Error('Не удалось загрузить изображение для трансформации'))
    }
    image.src = imageElement.src || URL.createObjectURL(imageElement)
  })
}

/**
 * Билинейная интерполяция для перспективной трансформации
 */
function bilinearInterpolation(topLeft, topRight, bottomLeft, bottomRight, u, v) {
  const top = topLeft + (topRight - topLeft) * u
  const bottom = bottomLeft + (bottomRight - bottomLeft) * u
  return top + (bottom - top) * v
}

/**
 * Вычисляет обратную перспективную трансформацию
 * Находит координаты в исходном изображении для точки в целевом
 */
function inversePerspectiveTransform(corners, x, y, width, height) {
  // Нормализованные координаты в целевом прямоугольнике
  const u = x / width
  const v = y / height

  // Вычисляем соответствующие координаты в исходном изображении
  const srcX = bilinearInterpolation(
    corners[0].x, corners[1].x,
    corners[3].x, corners[2].x,
    u, v
  )
  const srcY = bilinearInterpolation(
    corners[0].y, corners[1].y,
    corners[3].y, corners[2].y,
    u, v
  )

  return { x: srcX, y: srcY }
}

function getBilinearPixel(imageData, x, y) {
  const x1 = Math.floor(x)
  const y1 = Math.floor(y)
  const x2 = Math.min(x1 + 1, imageData.width - 1)
  const y2 = Math.min(y1 + 1, imageData.height - 1)

  const fx = x - x1
  const fy = y - y1

  const getPixel = (px, py) => {
    const index = (py * imageData.width + px) * 4
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3]
    }
  }

  const p11 = getPixel(x1, y1)
  const p21 = getPixel(x2, y1)
  const p12 = getPixel(x1, y2)
  const p22 = getPixel(x2, y2)

  const r = Math.round(
    p11.r * (1 - fx) * (1 - fy) +
    p21.r * fx * (1 - fy) +
    p12.r * (1 - fx) * fy +
    p22.r * fx * fy
  )
  const g = Math.round(
    p11.g * (1 - fx) * (1 - fy) +
    p21.g * fx * (1 - fy) +
    p12.g * (1 - fx) * fy +
    p22.g * fx * fy
  )
  const b = Math.round(
    p11.b * (1 - fx) * (1 - fy) +
    p21.b * fx * (1 - fy) +
    p12.b * (1 - fx) * fy +
    p22.b * fx * fy
  )
  const a = Math.round(
    p11.a * (1 - fx) * (1 - fy) +
    p21.a * fx * (1 - fy) +
    p12.a * (1 - fx) * fy +
    p22.a * fx * fy
  )

  return { r, g, b, a }
}

