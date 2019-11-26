/**
 * kbone svg polyfill
 * 支持自动探测 dom 树上的 svg、symbol 元素，进行对应的渲染
 */
module.exports = (window) => {
  const symbolMap = {};

  const symbolListeners = {};

  const parseSvgToDataURI = (svg) => {
    svg = svg.replace(/(<\/?)symbol/g, '$1svg');
    svg = svg.replace(/data-(.*?=(['"]).*?\2)/g, '$1');
    svg = svg.replace(/view-box=/g, 'viewBox=');
    svg = svg.replace(/(id|style|xmlns)=(['"]).*?\2/g, '');
    svg = svg.replace(/\d+\.\d+/g, (match) => parseFloat(parseFloat(match).toFixed(2)));
    svg = svg.replace(/<(title|desc)>[\s\S]*?<\/\1>/g, '');
    svg = svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'")
    svg = svg.replace(/"/g, "'");
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    svg = svg.replace(/\s+/g, " ");
    svg = svg.replace(/[{}\|\\\^~\[\]`"<>#%]/g, function (match) {
      return '%' + match[0].charCodeAt(0).toString(16).toUpperCase();
    });

    return 'data:image/svg+xml,' + svg.trim();
  }

  const resolveSymbol = (el) => {
    const symbolId = el.id;
    el.id = null;
    el.style.display = 'none';

    const symbol = el.outerHTML;

    symbolMap[symbolId] = parseSvgToDataURI(symbol);
    setTimeout(() => (symbolListeners[symbolId] || []).forEach(fn => fn()), 0);

    console.log('[小程序 SVG polyfill] 解析 Symbol 完成', { svg: symbol, data: symbolMap[symbolId] });
  }

  const renderSvg = (el) => {
    el.querySelectorAll('defs').forEach(def => {
      def.querySelectorAll('symbol').forEach(resolveSymbol);
      el.removeChild(def);
    });

    let svg = el.outerHTML;

    const symbolId = (/data-xlink-href="#(.*?)"/.exec(svg) || [])[1];

    let svgDataURI;

    if (symbolId) {
      svgDataURI = symbolMap[symbolId];

      symbolListeners[symbolId] = (symbolListeners[symbolId] || []).concat(() => {
        renderSvg(el, 'symbolUpdate');
      });
    } else {
      svgDataURI = parseSvgToDataURI(svg);
    }

    if (!svgDataURI) return;

    const backgroundImage = `url("${svgDataURI}")`;

    if (backgroundImage.length > 5000) {
      console.error('[小程序 SVG polyfill] SVG 长度超限', { svg, data: svgDataURI });
    }

    el.style.backgroundImage = backgroundImage;
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';

    console.log('[小程序 SVG polyfill] 渲染 SVG 元素完成', { svg, data: svgDataURI });
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