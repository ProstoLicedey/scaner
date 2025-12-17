/**
 * Вспомогательная функция для конвертации ImageData в cv.Mat
 */
function imageDataToMat(imageData) {
  return cv.matFromImageData(imageData);
}

/**
 * Вспомогательная функция для конвертации cv.Mat обратно в ImageData
 */
function matToImageData(mat) {
  // Убедимся, что у нас 4 канала (RGBA)
  let img;
  if (mat.channels() === 1) {
    img = new cv.Mat();
    cv.cvtColor(mat, img, cv.COLOR_GRAY2RGBA);
  } else if (mat.channels() === 3) {
    img = new cv.Mat();
    cv.cvtColor(mat, img, cv.COLOR_RGB2RGBA);
  } else {
    img = mat;
  }

  const imgData = new ImageData(
    new Uint8ClampedArray(img.data),
    img.cols,
    img.rows
  );

  if (img !== mat) img.delete();
  return imgData;
}

// ==========================================
// ВНУТРЕННИЕ ФУНКЦИИ (Работают напрямую с Mat)
// ==========================================

function _doBrightness(src, dst, value) {
  const factor = value / 100;
  // alpha = 1 (контраст не меняем), beta = сдвиг яркости
  src.convertTo(dst, -1, 1, factor * 255);
}

function _doContrast(src, dst, value) {
  // Формула контраста: F = 259(C+255) / 255(259-C)
  // Pixel = F * (Pixel - 128) + 128  =>  Pixel * F + (128 - 128*F)
  // alpha = F, beta = 128 * (1 - F)

  // Защита от деления на ноль при value = 259 (хотя вход обычно -100..100)
  if (value === 259) value = 258;

  const factor = (259 * (value + 255)) / (255 * (259 - value));
  const alpha = factor;
  const beta = 128 * (1 - factor);

  src.convertTo(dst, -1, alpha, beta);
}

function _doSharpness(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  const strength = value / 100;

  // Unsharp Masking: Original + Strength * (Original - Blurred)
  // Это эквивалент повышения резкости через вычитание размытой копии
  let blurred = new cv.Mat();
  // Используем GaussianBlur для создания нерезкой маски
  cv.GaussianBlur(src, blurred, new cv.Size(0, 0), 3);

  // dst = src * (1 + strength) + blurred * (-strength) + 0
  cv.addWeighted(src, 1 + strength, blurred, -strength, 0, dst);

  blurred.delete();
}

function _doSaturation(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  const factor = value / 100;

  // Реализация через смешивание с Grayscale (как в оригинале)
  let gray = new cv.Mat();
  let grayRGB = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.cvtColor(gray, grayRGB, cv.COLOR_GRAY2RGBA);

  // dst = gray * (-factor) + src * (1 + factor) ??
  // Формула оригинала: gray + (color - gray) * (1 + factor)
  // = gray + color(1+f) - gray(1+f) = color(1+f) - gray*f

  cv.addWeighted(src, 1 + factor, grayRGB, -factor, 0, dst);

  gray.delete();
  grayRGB.delete();
}

function _doDenoise(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  // value / 100 * 2 -> radius. Ksize = 2*radius + 1
  // Для медианного фильтра ksize должен быть нечетным и > 1
  let ksize = Math.floor((value / 100) * 2) * 2 + 1;
  if (ksize < 3) ksize = 3;

  cv.medianBlur(src, dst, ksize);
}

function _doColorCorrection(src, dst, temperature, tint) {
  if (temperature === 0 && tint === 0) {
    src.copyTo(dst);
    return;
  }

  const tempFactor = temperature / 100;
  const tintFactor = tint / 100;

  // Разделяем каналы для быстрой арифметики
  let planes = new cv.MatVector();
  cv.split(src, planes);
  let r = planes.get(0);
  let g = planes.get(1);
  let b = planes.get(2);
  let a = planes.get(3); // Альфа канал, если есть

  // Коррекция температуры (R+, B-)
  if (tempFactor !== 0) {
    let shift = tempFactor * 30;
    // Используем add/subtract с скаляром, OpenCV сам обрежет 0..255
    if (tempFactor > 0) {
      cv.add(r, new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(shift)), r);
      cv.subtract(
        b,
        new cv.Mat(b.rows, b.cols, b.type(), new cv.Scalar(shift)),
        b
      );
    } else {
      cv.subtract(
        r,
        new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(Math.abs(shift))),
        r
      );
      cv.add(
        b,
        new cv.Mat(b.rows, b.cols, b.type(), new cv.Scalar(Math.abs(shift))),
        b
      );
    }
  }

  // Коррекция оттенка (G+, R-, B-)
  if (tintFactor !== 0) {
    let gShift = tintFactor * 20;
    let rbShift = tintFactor * 10;

    if (tintFactor > 0) {
      cv.add(g, new cv.Mat(g.rows, g.cols, g.type(), new cv.Scalar(gShift)), g);
      cv.subtract(
        r,
        new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(rbShift)),
        r
      );
      cv.subtract(
        b,
        new cv.Mat(b.rows, b.cols, b.type(), new cv.Scalar(rbShift)),
        b
      );
    } else {
      cv.subtract(
        g,
        new cv.Mat(g.rows, g.cols, g.type(), new cv.Scalar(Math.abs(gShift))),
        g
      );
      cv.add(
        r,
        new cv.Mat(r.rows, r.cols, r.type(), new cv.Scalar(Math.abs(rbShift))),
        r
      );
      cv.add(
        b,
        new cv.Mat(b.rows, b.cols, b.type(), new cv.Scalar(Math.abs(rbShift))),
        b
      );
    }
  }

  cv.merge(planes, dst);

  planes.delete();
  r.delete();
  g.delete();
  b.delete();
  a.delete();
}

function _doBinarization(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  const strength = value / 100;

  let gray = new cv.Mat();
  let bin = new cv.Mat();
  let binRGB = new cv.Mat();

  // Грейскейл
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // OTSU Thresholding (автоматический поиск порога)
  cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

  // Конвертируем обратно в RGB для смешивания
  cv.cvtColor(bin, binRGB, cv.COLOR_GRAY2RGBA);

  // Смешивание оригинала и бинарного изображения по силе эффекта
  cv.addWeighted(src, 1 - strength, binRGB, strength, 0, dst);

  gray.delete();
  bin.delete();
  binRGB.delete();
}

function _doTextEnhancement(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  const strength = value / 100;

  // Аналог "Unsharp Mask" с большим радиусом для локального контраста текста
  // В оригинале используется локальное среднее (local mean)
  let blurred = new cv.Mat();
  // Ksize ~ 9 как в оригинале, или адаптивный от размера
  cv.GaussianBlur(src, blurred, new cv.Size(9, 9), 0);

  // Усиление разницы между оригиналом и локальным средним
  // dst = src + (src - blurred) * strength * 2 (условно)
  cv.addWeighted(src, 1 + strength, blurred, -strength, 0, dst);

  blurred.delete();
}

function _doWhiteBackground(src, dst, value) {
  if (value === 0) {
    src.copyTo(dst);
    return;
  }
  // Упрощенная логика: "выбивание" фона
  // Можно использовать адаптивный порог, но для слайдера value
  // лучше подойдет гамма-коррекция или Levels, чтобы сделать светлые участки белыми

  // Реализация "Levels": сдвигаем точку белого влево
  const factor = value / 100;
  const threshold = 255 - factor * 50; // Чем больше value, тем ниже порог белого

  // Умножаем пиксели так, чтобы threshold стал 255
  const alpha = 255 / threshold;
  src.convertTo(dst, -1, alpha, 0);
}

// ==========================================
// ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ (ImageData wrapper)
// ==========================================

export function applyBrightness(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doBrightness(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applyContrast(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doContrast(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applySharpness(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doSharpness(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applySaturation(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doSaturation(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applyDenoise(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doDenoise(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applyColorCorrection(imageData, temperature, tint) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doColorCorrection(src, dst, temperature, tint);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

// Применяет бинаризацию (Оцу)
export function applyBinarization(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doBinarization(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

// Улучшает белый фон документа (переименованная вторая applyBinarization)
export function applyWhiteBackground(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doWhiteBackground(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

export function applyTextEnhancement(imageData, value) {
  let src = imageDataToMat(imageData);
  let dst = new cv.Mat();
  _doTextEnhancement(src, dst, value);
  let res = matToImageData(dst);
  src.delete();
  dst.delete();
  return res;
}

// Автоматическое улучшение изображения
export function autoEnhance(imageData) {
  // Конвертируем один раз для анализа
  let src = imageDataToMat(imageData);
  let gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // 1. Auto Brightness Calculation
  // Аналог calculateAutoBrightness (mean value)
  let mean = cv.mean(gray);
  let avg = mean[0];
  const brightnessVal = ((128 - avg) / 128) * 50;

  // 2. Auto Contrast Calculation
  // Аналог calculateAutoContrast (minMaxLoc)
  let minMax = cv.minMaxLoc(gray);
  const range = minMax.maxVal - minMax.minVal;
  let contrastVal = 0;
  if (range < 50) {
    contrastVal = Math.min(50, (50 - range) / 2);
  }

  // Освобождаем временные ресурсы
  gray.delete();
  src.delete();

  // Применяем фильтры (используя applyAllFilters для эффективности)
  // Мы создаем объект filters как в applyAllFilters
  const filters = {
    brightness: brightnessVal,
    contrast: contrastVal,
    sharpness: 20,
    saturation: 10,
    denoise: 15,
    // Остальные нули
    temperature: 0,
    tint: 0,
    whiteBackground: 0,
    textEnhancement: 0,
    binarization: 0,
  };

  return applyAllFilters(imageData, filters);
}

// Применяет все фильтры к изображению (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
export function applyAllFilters(imageData, filters) {
  // Вместо того чтобы гонять ImageData <-> Mat много раз,
  // мы создаем Mat один раз и модифицируем его.

  let mat = imageDataToMat(imageData);
  let tempMat = new cv.Mat(); // буфер для операций

  if (filters.brightness !== 0) {
    _doBrightness(mat, tempMat, filters.brightness);
    tempMat.copyTo(mat);
  }

  if (filters.contrast !== 0) {
    _doContrast(mat, tempMat, filters.contrast);
    tempMat.copyTo(mat);
  }

  if (filters.sharpness !== 0) {
    _doSharpness(mat, tempMat, filters.sharpness);
    tempMat.copyTo(mat);
  }

  if (filters.saturation !== 0) {
    _doSaturation(mat, tempMat, filters.saturation);
    tempMat.copyTo(mat);
  }

  if (filters.denoise !== 0) {
    _doDenoise(mat, tempMat, filters.denoise);
    tempMat.copyTo(mat);
  }

  if (filters.temperature !== 0 || filters.tint !== 0) {
    _doColorCorrection(mat, tempMat, filters.temperature, filters.tint);
    tempMat.copyTo(mat);
  }

  if (filters.whiteBackground !== 0) {
    _doWhiteBackground(mat, tempMat, filters.whiteBackground);
    tempMat.copyTo(mat);
  }

  if (filters.textEnhancement !== 0) {
    _doTextEnhancement(mat, tempMat, filters.textEnhancement);
    tempMat.copyTo(mat);
  }

  if (filters.binarization !== 0) {
    _doBinarization(mat, tempMat, filters.binarization);
    tempMat.copyTo(mat);
  }

  let result = matToImageData(mat);

  // Очистка
  mat.delete();
  tempMat.delete();

  return result;
}
