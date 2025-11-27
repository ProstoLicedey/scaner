// Выбирает 4 наиболее удаленные точки из массива точек
// Использует квадранты для выбора углов
function selectFourCorners(points, imageWidth, imageHeight) {
  if (points.length <= 4) return points;

  // Находим центр всех точек
  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };

  // Разделяем точки на 4 квадранта
  const quadrants = [
    { points: [] }, // верхний-левый
    { points: [] }, // верхний-правый
    { points: [] }, // нижний-правый
    { points: [] }, // нижний-левый
  ];

  // Распределяем точки по квадрантам
  for (const point of points) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    let quadrant;

    if (dx < 0 && dy < 0) quadrant = 0;
    else if (dx >= 0 && dy < 0) quadrant = 1;
    else if (dx >= 0 && dy >= 0) quadrant = 2;
    else quadrant = 3;

    const distance = Math.sqrt(dx * dx + dy * dy);
    quadrants[quadrant].points.push({ point, distance });
  }

  // Выбираем наиболее удаленную точку из каждого квадранта
  const selected = [];
  for (const quad of quadrants) {
    if (quad.points.length > 0) {
      const farthest = quad.points.reduce((max, p) =>
        p.distance > max.distance ? p : max
      );
      selected.push(farthest.point);
    }
  }

  // Если не нашли 4 точки, дополняем ближайшими к углам изображения
  if (selected.length < 4) {
    const remaining = points.filter(
      (p) => !selected.some((s) => s.x === p.x && s.y === p.y)
    );
    const targetCorners = [
      { x: 0, y: 0 },
      { x: imageWidth, y: 0 },
      { x: imageWidth, y: imageHeight },
      { x: 0, y: imageHeight },
    ];

    for (let i = selected.length; i < 4; i++) {
      const targetCorner = targetCorners[i];
      let bestPoint = remaining[0];
      let minDist = Infinity;

      for (const point of remaining) {
        const dist =
          Math.pow(point.x - targetCorner.x, 2) +
          Math.pow(point.y - targetCorner.y, 2);

        if (dist < minDist) {
          minDist = dist;
          bestPoint = point;
        }
      }

      if (bestPoint && remaining.length > 0) {
        selected.push(bestPoint);
        const index = remaining.findIndex(
          (p) => p.x === bestPoint.x && p.y === bestPoint.y
        );
        if (index !== -1) remaining.splice(index, 1);
      }
    }
  }

  return selected.slice(0, 4);
}

// Определение углов документа с использованием OpenCV.js
export async function detectCorners(imageElement) {
  return new Promise((resolve, reject) => {
    if (typeof cv === "undefined" || !cv.Mat || !cv.imread) {
      reject(new Error("OpenCV.js не загружен"));
      return;
    }

    try {
      if (!imageElement || !imageElement.width || !imageElement.height) {
        reject(new Error("Изображение не загружено"));
        return;
      }

      // Загружаем изображение в OpenCV
      const src = cv.imread(imageElement);
      if (!src || src.empty()) {
        reject(new Error("Не удалось загрузить изображение в OpenCV"));
        return;
      }

      // Конвертируем в grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Уменьшаем шум
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // Пороговая обработка для выделения белого листа
      const thresh = new cv.Mat();
      cv.threshold(blurred, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

      // Морфологические операции для очистки
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      const morphed = new cv.Mat();
      cv.morphologyEx(thresh, morphed, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1);

      const closed = new cv.Mat();
      cv.morphologyEx(morphed, closed, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 2);

      // Находим контуры
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Ищем наибольший контур (белый лист)
      let maxArea = 0;
      let bestContour = null;
      const minArea = imageElement.width * imageElement.height * 0.1;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area > maxArea && area > minArea) {
          maxArea = area;
          if (bestContour) bestContour.delete();
          bestContour = contour.clone();
        }
        contour.delete();
      }

      // Очистка памяти OpenCV
      src.delete();
      gray.delete();
      blurred.delete();
      thresh.delete();
      morphed.delete();
      closed.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      if (bestContour) {
        // Аппроксимируем контур до многоугольника
        const epsilon = 0.02 * cv.arcLength(bestContour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(bestContour, approx, epsilon, true);

        // Преобразуем в массив точек
        const corners = [];
        for (let i = 0; i < approx.rows; i++) {
          const point = approx.intPtr(i, 0);
          corners.push({ x: point[0], y: point[1] });
        }

        approx.delete();
        bestContour.delete();

        // Обрабатываем количество точек
        let finalCorners = corners;
        if (corners.length > 4) {
          finalCorners = selectFourCorners(corners, imageElement.width, imageElement.height);
        } else if (corners.length < 4) {
          const defaultCorners = [
            { x: 0, y: 0 },
            { x: imageElement.width, y: 0 },
            { x: imageElement.width, y: imageElement.height },
            { x: 0, y: imageElement.height },
          ];
          finalCorners = [...corners];
          for (let i = corners.length; i < 4; i++) {
            finalCorners.push(defaultCorners[i]);
          }
        }

        const sortedCorners = sortCorners(finalCorners);
        resolve(sortedCorners);
      } else {
        // Возвращаем углы по умолчанию
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

// Сортирует углы: верхний-левый, верхний-правый, нижний-правый, нижний-левый
function sortCorners(corners) {
  if (corners.length !== 4) return corners;

  const center = {
    x: corners.reduce((sum, p) => sum + p.x, 0) / 4,
    y: corners.reduce((sum, p) => sum + p.y, 0) / 4,
  };

  // Сортируем по углу относительно центра
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

// Альтернативный метод без OpenCV (использует Canvas API)
export async function detectCornersSimple(imageElement) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Вычисляем среднюю яркость для определения порога
    let sum = 0;
    const brightnessValues = [];
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      brightnessValues.push(brightness);
      sum += brightness;
    }
    const avgBrightness = sum / brightnessValues.length;
    const threshold = Math.min(200, avgBrightness + 30);

    // Создаем бинарное изображение
    const binary = new Array(canvas.width * canvas.height).fill(0);
    for (let i = 0; i < brightnessValues.length; i++) {
      if (brightnessValues[i] >= threshold) {
        binary[i] = 1;
      }
    }

    // Находим границы белой области
    let topEdge = -1, bottomEdge = -1, leftEdge = -1, rightEdge = -1;
    const margin = Math.min(canvas.width, canvas.height) * 0.05;
    const scanMargin = Math.max(10, margin);

    // Сканируем сверху вниз
    for (let y = scanMargin; y < canvas.height - scanMargin; y++) {
      let whiteCount = 0;
      for (let x = scanMargin; x < canvas.width - scanMargin; x++) {
        if (binary[y * canvas.width + x] === 1) whiteCount++;
      }
      if (whiteCount > (canvas.width - 2 * scanMargin) * 0.3) {
        topEdge = y;
        break;
      }
    }

    // Сканируем снизу вверх
    for (let y = canvas.height - scanMargin; y >= scanMargin; y--) {
      let whiteCount = 0;
      for (let x = scanMargin; x < canvas.width - scanMargin; x++) {
        if (binary[y * canvas.width + x] === 1) whiteCount++;
      }
      if (whiteCount > (canvas.width - 2 * scanMargin) * 0.3) {
        bottomEdge = y;
        break;
      }
    }

    // Сканируем слева направо
    for (let x = scanMargin; x < canvas.width - scanMargin; x++) {
      let whiteCount = 0;
      for (let y = scanMargin; y < canvas.height - scanMargin; y++) {
        if (binary[y * canvas.width + x] === 1) whiteCount++;
      }
      if (whiteCount > (canvas.height - 2 * scanMargin) * 0.3) {
        leftEdge = x;
        break;
      }
    }

    // Сканируем справа налево
    for (let x = canvas.width - scanMargin; x >= scanMargin; x--) {
      let whiteCount = 0;
      for (let y = scanMargin; y < canvas.height - scanMargin; y++) {
        if (binary[y * canvas.width + x] === 1) whiteCount++;
      }
      if (whiteCount > (canvas.height - 2 * scanMargin) * 0.3) {
        rightEdge = x;
        break;
      }
    }

    // Формируем углы
    if (topEdge !== -1 && bottomEdge !== -1 && leftEdge !== -1 && rightEdge !== -1) {
      const corners = [
        { x: Math.max(0, leftEdge - scanMargin), y: Math.max(0, topEdge - scanMargin) },
        { x: Math.min(canvas.width, rightEdge + scanMargin), y: Math.max(0, topEdge - scanMargin) },
        { x: Math.min(canvas.width, rightEdge + scanMargin), y: Math.min(canvas.height, bottomEdge + scanMargin) },
        { x: Math.max(0, leftEdge - scanMargin), y: Math.min(canvas.height, bottomEdge + scanMargin) },
      ];
      resolve(sortCorners(corners));
    } else {
      resolve(sortCorners([
        { x: 0, y: 0 },
        { x: canvas.width, y: 0 },
        { x: canvas.width, y: canvas.height },
        { x: 0, y: canvas.height },
      ]));
    }
  });
}
