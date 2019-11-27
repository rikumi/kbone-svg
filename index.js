/**
 * kbone svg polyfill
 * 支持自动探测 dom 树上的 svg、symbol 元素，进行对应的渲染
 */
module.exports = (window) => {
  const symbolMap = {};
  const symbolUseMap = {};

  const parseSvgToDataURI = (svg) => {
    svg = svg.replace(/data-(.*?=(['"]).*?\2)/g, '$1');
    svg = svg.replace(/xlink-href=/g, 'xlink:href=');
    svg = svg.replace(/view-box=/g, 'viewBox=');
    svg = svg.replace(/<(title|desc|defs)>[\s\S]*?<\/\1>/g, '');
    if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'");

    svg = svg.replace(/\d+\.\d+/g, (match) => parseFloat(parseFloat(match).toFixed(2)));
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    svg = svg.replace(/\s+/g, " ");
    svg = svg.replace(/[{}\|\\\^~\[\]`"<>#%]/g, function (match) {
      return '%' + match[0].charCodeAt(0).toString(16).toUpperCase();
    });
    svg = svg.replace(/'/g, "\\'");

    return 'data:image/svg+xml,' + svg.trim();
  }

  const resolveSymbol = (el) => {
    const symbolId = el.id;
    el.id = null;
    const symbol = el;

    if (symbolMap[symbolId] !== symbol) {
      symbolMap[symbolId] = symbol;
      setTimeout(() => symbolUseMap[symbolId] && symbolUseMap[symbolId].forEach(renderSvg), 0);
    }

    console.log('[kbone-svg] 保存 Symbol 完成', symbol);
    return symbolId;
  }

  const renderSvg = (el) => {
    if (el.style.backgroundImage) return;

    const localSymbols = new Set(el.querySelectorAll('symbol').map(resolveSymbol));

    let isFullRendered = true;

    el.querySelectorAll('use').forEach(use => {
      const symbolId = (use.getAttribute('xlink:href') || use.getAttribute('data-xlink-href')).replace(/^#/, '');
      if (localSymbols.has(symbolId)) return;

      const symbol = symbolMap[symbolId];

      if (symbol) {
        const parentNode = use.parentNode;
        parentNode.innerHTML = symbol.innerHTML;
        parentNode.setAttribute('viewBox', symbol.getAttribute('viewBox'));

        if (!symbolUseMap[symbolId]) symbolUseMap[symbolId] = new Set();
        symbolUseMap[symbolId].delete(el);
      } else {
        if (!symbolUseMap[symbolId]) symbolUseMap[symbolId] = new Set();
        symbolUseMap[symbolId].add(el);
        isFullRendered = false;
      }
    });

    if (!isFullRendered) return;

    el.querySelectorAll('title').forEach((child) => el.removeChild(child));
    el.querySelectorAll('desc').forEach((child) => el.removeChild(child));

    let svg = el.outerHTML;

    const svgDataURI = parseSvgToDataURI(svg);
    const backgroundImage = `url('${svgDataURI}')`;

    if (backgroundImage.length > 5000) {
      console.error('[kbone-svg] SVG 长度超限', { svg, data: svgDataURI });
    }

    el.innerHTML = '';

    if (el.getAttribute('width')) el.style.width = el.getAttribute('width') + 'px';
    if (el.getAttribute('height')) el.style.height = el.getAttribute('height') + 'px';

    el.style.backgroundImage = backgroundImage;
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';

    console.log('[kbone-svg] 渲染 SVG 元素完成', { svg, data: svgDataURI });
  }

  window.$$addAspect('document.$$createElement.after', (el) => {
    if (el.tagName.toLowerCase() === 'svg') {
      setTimeout(() => renderSvg.call(null, el, 'init'), 0);
    }
  });

  const _setAttribute = window.Element.prototype.setAttribute;
  window.Element.prototype.setAttribute = function (attribute, value) {
    const oldHtml = this.outerHTML;
    _setAttribute.call(this, attribute, value);
    const newHtml = this.outerHTML;
    if (oldHtml === newHtml) {
      this.dataset[attribute] = value;
    }
  }

  window.Element.prototype.setAttributeNS = function (xmlns, attribute, value) {
    this.setAttribute('data-' + attribute.replace(':', '-'), value)
  }
}