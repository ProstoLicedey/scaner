// Вычисляет оптимальные размеры выходного изображения на основе углов
export function calculateOptimalOutputSize(corners) {
  if (!corners || corners.length !== 4) {
    return { width: 800, height: 1000 };
  }

  // Вычисляем длины сторон четырехугольника
  const topWidth = Math.sqrt(
    Math.pow(corners[1].x - corners[0].x, 2) +
      Math.pow(corners[1].y - corners[0].y, 2)
  );
  const bottomWidth = Math.sqrt(
    Math.pow(corners[2].x - corners[3].x, 2) +
      Math.pow(corners[2].y - corners[3].y, 2)
  );
  const leftHeight = Math.sqrt(
    Math.pow(corners[3].x - corners[0].x, 2) +
      Math.pow(corners[3].y - corners[0].y, 2)
  );
  const rightHeight = Math.sqrt(
    Math.pow(corners[2].x - corners[1].x, 2) +
      Math.pow(corners[2].y - corners[1].y, 2)
  );

  // Используем средние значения для правильных пропорций
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;

  // Добавляем 1% запас, чтобы ничего не обрезалось
  const width = Math.ceil(avgWidth * 1.01);
  const height = Math.ceil(avgHeight * 1.01);

  const minSize = 100;
  return {
    width: Math.max(minSize, width),
    height: Math.max(minSize, height),
  };
}

// Перспективная трансформация изображения
export function transformPerspectiveCanvas(
  imageElement,
  corners,
  outputWidth,
  outputHeight
) {
  return new Promise(async (resolve, reject) => {
    if (!corners || corners.length !== 4) {
      reject(new Error("Неверное количество углов"));
      return;
    }

    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (
        typeof c.x !== "number" ||
        typeof c.y !== "number" ||
        isNaN(c.x) ||
        isNaN(c.y)
      ) {
        reject(new Error(`Неверные координаты угла ${i}`));
        return;
      }
    }

    const width = Math.max(100, Math.floor(outputWidth || 800));
    const height = Math.max(100, Math.floor(outputHeight || 1000));

    // Проверяем наличие OpenCV
    if (typeof cv === "undefined" || !cv.Mat || !cv.imread) {
      reject(new Error("OpenCV.js не загружен"));
      return;
    }

    const imgEl = imageElement;
    const srcMat = cv.imread(imgEl);
    if (!srcMat || srcMat.empty()) {
      reject(new Error("Не удалось прочитать изображение для трансформации"));
      return;
    }

    try {
      // Исходные углы (источник): порядок TL, TR, BR, BL
      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        corners[0].x,
        corners[0].y,
        corners[1].x,
        corners[1].y,
        corners[2].x,
        corners[2].y,
        corners[3].x,
        corners[3].y,
      ]);

      // Целевые углы (прямоугольник по размерам вывода)
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        width,
        0,
        width,
        height,
        0,
        height,
      ]);

      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      const dstMat = new cv.Mat();
      const dsize = new cv.Size(width, height);

      cv.warpPerspective(
        srcMat,
        dstMat,
        M,
        dsize,
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255)
      );

      // Конвертируем результат в Canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      cv.imshow(canvas, dstMat);

      // Очистка
      srcMat.delete();
      dstMat.delete();
      srcPts.delete();
      dstPts.delete();
      M.delete();

      resolve(canvas);
    } catch (e) {
      // Очистка в случае ошибки
      srcMat.delete();
      reject(e);
    }
  });
}

// Билинейная интерполяция между четырьмя точками
function bilinearInterpolation(
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  u,
  v
) {
  const top = topLeft + (topRight - topLeft) * u;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * u;
  return top + (bottom - top) * v;
}

// Вычисляет обратную перспективную трансформацию
// Находит координаты в исходном изображении для точки в целевом
function inversePerspectiveTransform(corners, x, y, width, height) {
  // Больше не используется после перехода на cv.warpPerspective
  const u = x / width;
  const v = y / height;
  const srcX = bilinearInterpolation(
    corners[0].x,
    corners[1].x,
    corners[3].x,
    corners[2].x,
    u,
    v
  );
  const srcY = bilinearInterpolation(
    corners[0].y,
    corners[1].y,
    corners[3].y,
    corners[2].y,
    u,
    v
  );
  return { x: srcX, y: srcY };
}

// Получает пиксель с билинейной интерполяцией
function getBilinearPixel(imageData, x, y) {
  // Больше не используется после перехода на cv.warpPerspective
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = Math.min(x1 + 1, imageData.width - 1);
  const y2 = Math.min(y1 + 1, imageData.height - 1);
  const fx = x - x1;
  const fy = y - y1;
  const getPixel = (px, py) => {
    const index = (py * imageData.width + px) * 4;
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3],
    };
  };
  const p11 = getPixel(x1, y1);
  const p21 = getPixel(x2, y1);
  const p12 = getPixel(x1, y2);
  const p22 = getPixel(x2, y2);
  const r = Math.round(
    p11.r * (1 - fx) * (1 - fy) +
      p21.r * fx * (1 - fy) +
      p12.r * (1 - fx) * fy +
      p22.r * fx * fy
  );
  const g = Math.round(
    p11.g * (1 - fx) * (1 - fy) +
      p21.g * fx * (1 - fy) +
      p12.g * (1 - fx) * fy +
      p22.g * fx * fy
  );
  const b = Math.round(
    p11.b * (1 - fx) * (1 - fy) +
      p21.b * fx * (1 - fy) +
      p12.b * (1 - fx) * fy +
      p22.b * fx * fy
  );
  const a = Math.round(
    p11.a * (1 - fx) * (1 - fy) +
      p21.a * fx * (1 - fy) +
      p12.a * (1 - fx) * fy +
      p22.a * fx * fy
  );
  return { r, g, b, a };
}
