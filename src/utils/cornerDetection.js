/**
 * Автоматическое определение углов документа с использованием OpenCV.js
 */

export async function detectCorners(imageElement) {
  return new Promise((resolve, reject) => {
    // Проверяем, загружен ли OpenCV
    if (typeof cv === "undefined" || !cv.Mat || !cv.imread) {
      reject(new Error("OpenCV.js не загружен или не инициализирован"));
      return;
    }

    try {
      // Убеждаемся, что изображение загружено
      if (!imageElement || !imageElement.width || !imageElement.height) {
        reject(new Error("Изображение не загружено"));
        return;
      }

      // Создаем Mat из изображения
      const src = cv.imread(imageElement);
      if (!src || src.empty()) {
        reject(new Error("Не удалось загрузить изображение в OpenCV"));
        return;
      }

      // Конвертируем в grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Применяем Gaussian blur для уменьшения шума
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // Применяем адаптивный порог для лучшего определения границ
      const thresh = new cv.Mat();
      cv.adaptiveThreshold(
        blurred,
        thresh,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        2
      );

      // Применяем Canny edge detection с более мягкими параметрами
      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 50, 150, 3, false);

      // Морфологические операции для соединения разрывов
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      const dilated = new cv.Mat();
      cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 2);

      // Находим контуры
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(
        dilated,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      // Ищем наибольший четырехугольник
      let maxArea = 0;
      let bestContour = null;
      const minArea = imageElement.width * imageElement.height * 0.1; // Минимум 10% от площади изображения

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > maxArea && area > minArea) {
          // Аппроксимируем контур с разными значениями epsilon
          let found = false;
          for (
            let epsilonFactor = 0.01;
            epsilonFactor <= 0.05;
            epsilonFactor += 0.01
          ) {
            const epsilon = epsilonFactor * cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, epsilon, true);

            // Проверяем, является ли контур четырехугольником
            if (approx.rows === 4) {
              maxArea = area;
              if (bestContour) bestContour.delete();
              bestContour = approx;
              found = true;
              break;
            } else {
              approx.delete();
            }
          }

          if (!found) {
            // Если не нашли 4 точки, берем наибольший контур и принудительно делаем 4 угла
            const epsilon = 0.02 * cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, epsilon, true);

            if (approx.rows >= 4) {
              // Берем первые 4 точки или выбираем 4 наиболее удаленные
              maxArea = area;
              if (bestContour) bestContour.delete();
              bestContour = approx;
            } else {
              approx.delete();
            }
          }
        }
        contour.delete();
      }

      // Очистка памяти
      src.delete();
      gray.delete();
      blurred.delete();
      thresh.delete();
      edges.delete();
      dilated.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      if (bestContour && bestContour.rows >= 4) {
        // Преобразуем точки контура в массив
        const corners = [];
        const pointCount = Math.min(bestContour.rows, 4);

        for (let i = 0; i < pointCount; i++) {
          const point = bestContour.intPtr(i, 0);
          corners.push({ x: point[0], y: point[1] });
        }

        // Если точек меньше 4, дополняем углами изображения
        if (corners.length < 4) {
          corners.push(
            { x: 0, y: 0 },
            { x: imageElement.width, y: 0 },
            { x: imageElement.width, y: imageElement.height },
            { x: 0, y: imageElement.height }
          );
          corners.splice(4); // Оставляем только 4
        }

        // Сортируем углы: верхний-левый, верхний-правый, нижний-правый, нижний-левый
        const sortedCorners = sortCorners(corners);
        bestContour.delete();

        resolve(sortedCorners);
      } else {
        // Если не нашли контур, возвращаем углы по умолчанию (все изображение)
        bestContour?.delete();
        resolve([
          { x: 0, y: 0 },
          { x: imageElement.width, y: 0 },
          { x: imageElement.width, y: imageElement.height },
          { x: 0, y: imageElement.height },
        ]);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Сортирует углы в порядке: верхний-левый, верхний-правый, нижний-правый, нижний-левый
 */
function sortCorners(corners) {
  if (corners.length !== 4) return corners;

  // Находим центр
  const center = {
    x: corners.reduce((sum, p) => sum + p.x, 0) / 4,
    y: corners.reduce((sum, p) => sum + p.y, 0) / 4,
  };

  // Сортируем углы относительно центра по углу
  const sorted = [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x);
    const angleB = Math.atan2(b.y - center.y, b.x - center.x);
    return angleA - angleB;
  });

  // Находим верхний левый угол (минимальная сумма x+y)
  let topLeftIndex = 0;
  let minSum = sorted[0].x + sorted[0].y;
  for (let i = 1; i < sorted.length; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      topLeftIndex = i;
    }
  }

  // Переставляем так, чтобы верхний левый был первым
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[(topLeftIndex + i) % sorted.length]);
  }

  return result;
}

/**
 * Альтернативный метод определения углов без OpenCV (упрощенный)
 */
export async function detectCornersSimple(imageElement) {
  return new Promise((resolve) => {
    // Создаем canvas для обработки
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    // Получаем ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Упрощенный метод: находим края по изменению яркости
    // Это запасной вариант, если OpenCV не работает
    const edgeThreshold = 30;
    const corners = [
      { x: 0, y: 0 },
      { x: canvas.width, y: 0 },
      { x: canvas.width, y: canvas.height },
      { x: 0, y: canvas.height },
    ];

    // Пытаемся найти реальные края документа
    // Ищем первый значительный переход яркости от краев
    const margin = Math.min(canvas.width, canvas.height) * 0.1;

    // Верхний край
    for (let y = margin; y < canvas.height / 2; y++) {
      let edgeFound = false;
      for (let x = margin; x < canvas.width - margin; x++) {
        const idx = (y * canvas.width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (brightness < 200) {
          corners[0] = {
            x: Math.max(0, x - margin),
            y: Math.max(0, y - margin),
          };
          corners[1] = {
            x: Math.min(canvas.width, canvas.width - x + margin),
            y: Math.max(0, y - margin),
          };
          edgeFound = true;
          break;
        }
      }
      if (edgeFound) break;
    }

    // Нижний край
    for (let y = canvas.height - margin; y > canvas.height / 2; y--) {
      let edgeFound = false;
      for (let x = margin; x < canvas.width - margin; x++) {
        const idx = (y * canvas.width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (brightness < 200) {
          corners[2] = {
            x: Math.min(canvas.width, canvas.width - x + margin),
            y: Math.min(canvas.height, y + margin),
          };
          corners[3] = {
            x: Math.max(0, x - margin),
            y: Math.min(canvas.height, y + margin),
          };
          edgeFound = true;
          break;
        }
      }
      if (edgeFound) break;
    }

    resolve(sortCorners(corners));
  });
}
