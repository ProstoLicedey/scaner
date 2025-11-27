// Вычисляет оптимальные размеры выходного изображения на основе углов
export function calculateOptimalOutputSize(corners) {
  if (!corners || corners.length !== 4) {
    return { width: 800, height: 1000 }
  }

  // Вычисляем длины сторон четырехугольника
  const topWidth = Math.sqrt(
    Math.pow(corners[1].x - corners[0].x, 2) + 
    Math.pow(corners[1].y - corners[0].y, 2)
  )
  const bottomWidth = Math.sqrt(
    Math.pow(corners[2].x - corners[3].x, 2) + 
    Math.pow(corners[2].y - corners[3].y, 2)
  )
  const leftHeight = Math.sqrt(
    Math.pow(corners[3].x - corners[0].x, 2) + 
    Math.pow(corners[3].y - corners[0].y, 2)
  )
  const rightHeight = Math.sqrt(
    Math.pow(corners[2].x - corners[1].x, 2) + 
    Math.pow(corners[2].y - corners[1].y, 2)
  )

  // Используем средние значения для правильных пропорций
  const avgWidth = (topWidth + bottomWidth) / 2
  const avgHeight = (leftHeight + rightHeight) / 2

  // Добавляем 1% запас, чтобы ничего не обрезалось
  const width = Math.ceil(avgWidth * 1.01)
  const height = Math.ceil(avgHeight * 1.01)

  const minSize = 100
  return {
    width: Math.max(minSize, width),
    height: Math.max(minSize, height)
  }
}

// Перспективная трансформация изображения
export function transformPerspectiveCanvas(imageElement, corners, outputWidth, outputHeight) {
  return new Promise((resolve, reject) => {
    if (!corners || corners.length !== 4) {
      reject(new Error('Неверное количество углов'))
      return
    }

    // Проверяем валидность углов
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

    // Заполняем белым фоном
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

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

        // Инициализируем белым цветом
        for (let i = 0; i < dstData.data.length; i += 4) {
          dstData.data[i] = 255     // R
          dstData.data[i + 1] = 255 // G
          dstData.data[i + 2] = 255 // B
          dstData.data[i + 3] = 255 // A
        }

        // Перспективная трансформация через обратное преобразование
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // Находим соответствующие координаты в исходном изображении
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
              } catch (pixelError) {
                // Игнорируем ошибки отдельных пикселей
              }
            }
          }
        }

        ctx.putImageData(dstData, 0, 0)
        resolve(canvas)
      } catch (error) {
        // Fallback: рисуем исходное изображение
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

// Билинейная интерполяция между четырьмя точками
function bilinearInterpolation(topLeft, topRight, bottomLeft, bottomRight, u, v) {
  const top = topLeft + (topRight - topLeft) * u
  const bottom = bottomLeft + (bottomRight - bottomLeft) * u
  return top + (bottom - top) * v
}

// Вычисляет обратную перспективную трансформацию
// Находит координаты в исходном изображении для точки в целевом
function inversePerspectiveTransform(corners, x, y, width, height) {
  // Нормализованные координаты (0-1)
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

// Получает пиксель с билинейной интерполяцией
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

  // Билинейная интерполяция
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
