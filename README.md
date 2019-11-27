# kbone-svg
微信小程序 kbone 框架的 SVG 支持

[阅读原文](https://rikumi.github.io/2019/11/27/kbone-svg/)

## 背景

2019 年底，微信小程序已经推出了近三个年头，我身边的前端开发者基本都做过至少一次小程序了。很多友商曾打算推动小程序进入 W3C 标准，而微信并不为所动，个人认为，小程序本身在框架设计上称不上「标准」，微信也并没打算做一个「标准的平台」。

小程序更注重产品形态和交互，注重对开发者能力的制约，尽可能减少对用户的干扰；因此，也许小程序从设计之初就没有过多考虑开发层面的「优雅」，而是以方便上手、容易学习为主。最典型的例子就是 `App()`、`Page()` 这一类直接注入到模块内的工厂方法，你不知道、也不需要知道它从何处来，来无影去无踪，是与现在 JS 生态中早已普及的模块化开发有点相悖的。

在架构上，小程序选择了将逻辑层与视图层分离的方式来组织业务代码。小程序的源码提交上传时，JS 会被打包成逻辑层代码（`app-service.js`），在运行时与逻辑层基础库 `WAService.js` 相结合，在逻辑层 Webview（或 JSCore）中执行；WXML/WXSS 将会编译成 JS 并拼接成 `page-frame.html`，在运行时与视图层基础库 `WAWebview.js` 相结合，在视图层堆栈的 Webview 中执行。基础库负责利用客户端提供的通信管道，相互建立联系，对小程序和页面的生命周期、页面上虚拟 DOM 的渲染等进行管理，并在必要时使用客户端提供的原生能力。

<img src="https://user-images.githubusercontent.com/5051300/69689794-db006900-1104-11ea-85b5-4cd21b45fd84.png" style="display:block;width:454px;height:auto;margin:20px auto;"/>

<p><center>小程序实例的典型架构</center></p>

熟悉小程序的开发者都知道，这样的架构最主要的目的就是禁止业务代码操作 DOM，迫使开发者使用数据驱动的开发方式，同时在小程序推出初期可以避免良莠不齐的 HTML 项目快速攻占小程序平台，后期则可以缓解小程序平台上的优质产品流失。

## kbone 是什么

从 2017 年初小程序推出开始，业界最关心的就是小程序能否转为普通的 Web 开发。最初我们只能简单的用 Babel 进行 JS 的转换；后来小程序推出了 web-view 组件，开发者则开始想办法让 Web 页面使用小程序能力；在知道了 web-view 中的消息不能实时传到小程序逻辑层后，大家则开始选择妥协，改用语法树转换的方式来实现。很多小程序开发框架都是在这一个阶段产生的，如 Wepy、Labrador、mpvue 和 Taro。

语法树转换终究是不可靠的——在 Wepy 和 Taro 的使用中，我们常常会碰到很多语法无法识别的坑，坑的数量与代码量成正比。因此，这些框架更适用于从零开始写，而不适合将一个大型项目移植到小程序。

[kbone](https://github.com/wechat-miniprogram/kbone) 是微信团队开源的微信小程序**同构**框架，与基于语法树转换的 Wepy、Taro 等传统框架不同，kbone 的思路是在逻辑层用类似 SSR 的方式模拟出 DOM 和 BOM 结构，让逻辑层的 HTML5 代码正常运行；而 kbone 会负责将逻辑层中的虚拟 DOM 以 setData 的形式传递给视图层，让视图层利用小程序组件递归渲染的能力，产生出真实的 DOM 结构。

使用 kbone 之后，我们可以将小程序页面理解为一个独立的 html 文档（而不是 SPA 中的一个 router page）。在每个页面的 JS 中初始化 kbone，为逻辑层提供虚拟 DOM 和 BOM 的环境，然后就可以像 H5 一样加载各种主流前端框架和业务代码，kbone 会负责逻辑层和视图层之间的 DOM 和事件同步。

## 让 kbone 支持 HTML5 inline SVG

在 HTML 中，SVG 的引入有很多种不同的方式，可以像图片一样使用 `<img>` 标签、`background-image` 属性，也可以直接在 HTML 中插入 `<svg>` 标签，另外还有 `<object>`、`<embed>` 等不太常见的方式。

在一些大型 web-view 项目迁移到 kbone 的过程中，常常会遇到 HTML inline SVG（在 HTML 中直接插入 SVG 标签）这种情况；有的页面还会异步加载一个含有很多小图标（`<symbol>`）的大 SVG、在页面上用 `<use xlink:href="#symbol-id">` 的方式，实现 SVG 的 Sprite 化。

本文针对单个页面上出现大量 HTML inline SVG 的实战场景，通过识别并转换成 `background-image`，来实现小程序 kbone 对 SVG 的支持。

### 构造用例

首先我们以 [kbone 官方示例](https://developers.weixin.qq.com/s/R9Hm0Qm67Acd) 为基础，导入该项目后，在项目根目录新建 `kbone-svg.js`，然后进入 `/pages/index/index.js`，在 `onLoad()` 的结尾先写出调用方式和示例：

```js
Page({
  data: ...,
  onLoad(query) {
    ...
    init(this.window, this.document)
    this.setData({ pageId: this.pageId })
    this.app = this.window.createApp()
    this.window.$$trigger('load')
    this.window.$$trigger('wxload', { event: query })

    // 添加我们的调用方式和示例
    require('../../svg.js')(this.window)

    this.document.body.innerHTML += `
      <p>SVG 渲染</p>
      <svg xmlns='http://www.w3.org/2000/svg' viewBox="0 0 40 40" id="bell" width="40" height="40">
        <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" opacity="0.65" transform="translate(3.8, 2.8)">
          <polygon fill="#000000" points="0.2 27.2 32.2 27.2 32.2 30.2 0.2 30.2" />
          <path d="M15.84,1.66 L6.6,6 L4.5,28.7 L27.16,28.7 L25.1,6.01 L15.84,1.66 Z" stroke="#000000" stroke-width="3" />
          <polygon fill="#000000" points="11.52 30.2 13.68 33.2 18 33.2 20.16 30.2" />
        </g>
      </svg>
    
      <p>SVG Symbol 渲染</p>
      <svg xmlns='http://www.w3.org/2000/svg' style="display:none">
        <defs><symbol viewBox="0 0 40 40" id="bell">
          <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" opacity="0.65" transform="translate(3.8, 2.8)">
            <polygon fill="#000000" points="0.2 27.2 32.2 27.2 32.2 30.2 0.2 30.2" />
            <path d="M15.84,1.66 L6.6,6 L4.5,28.7 L27.16,28.7 L25.1,6.01 L15.84,1.66 Z" stroke="#000000" stroke-width="3" />
            <polygon fill="#000000" points="11.52 30.2 13.68 33.2 18 33.2 20.16 30.2" />
          </g>
        </symbol></defs>
      </svg>

      <svg xmlns='http://www.w3.org/2000/svg' width="40" height="40">
        <use xlink:href="#bell"></use>
      </svg>
      
      <p>SVG 自引用渲染</p>
      <svg viewBox="0 0 80 20" width="80" height="20" xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink">
        <!-- Our symbol in its own coordinate system -->
        <symbol id="myDot" width="10" height="10" viewBox="0 0 2 2">
          <circle cx="1" cy="1" r="1" />
        </symbol>
      
        <!-- A grid to materialize our symbol positioning -->
        <path d="M0,10 h80 M10,0 v20 M25,0 v20 M40,0 v20 M55,0 v20 M70,0 v20" fill="none" stroke="pink" />
      
        <!-- All instances of our symbol -->
        <use xlink:href="#myDot" x="5"  y="5" style="opacity:1.0" />
        <use xlink:href="#myDot" x="20" y="5" style="opacity:0.8" />
        <use xlink:href="#myDot" x="35" y="5" style="opacity:0.6" />
        <use xlink:href="#myDot" x="50" y="5" style="opacity:0.4" />
        <use xlink:href="#myDot" x="65" y="5" style="opacity:0.2" />
      </svg>
    `
  }
})
```

本例中，结合 `<defs>` `<symbol>` 和 `<use>` 的[文档](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/symbol)，给出了三种示例，分别用来代表普通 SVG 的渲染、跨 SVG 引用 Symbol（类似于雪碧图）的渲染、以及 SVG 内引用当前文档中的 Symbol 的渲染情况。

## 分析和实现

上述示例中，我们模拟 H5 条件下最一般的情况，直接在 body 下添加 HTML。如何支持这样的情况？首先我们打开 kbone 的代码 `/miniprogram_npm/miniprogram-render/node/element.js`，观察 `innerHTML` 的 setter：

```js
set innerHTML(html) {
  if (typeof html !== 'string') return

  const fragment = this.ownerDocument.$$createElement({
    tagName: 'documentfragment',
    // ...
  })

  // ...
  ast = parser.parse(html)
  // ...

  // 生成 dom 树
  ast.forEach(item => {
    const node = this.$_generateDomTree(item) // <--
    if (node) fragment.appendChild(node)
  })

  // 删除所有子节点
  this.$_children.forEach(node => {
    // ...
  })
  this.$_children.length = 0

  // ...
  this.appendChild(fragment)
}
```

可以看到，`innerHTML` 被转化成 `$_generateDomTree` 的调用，生成新的子节点，并替换掉所有旧的子节点。而在 `$_generateDomTree` 中，最终将会调用 `this.ownerDocument.$$createElement`。

根据 `/miniprogram_npm/miniprogram-render/document.js` 中的定义，`Document.prototype.$$createElement` 作为我们熟知的 `Document.prototype.createElement` 的内部实现，因此为了监听 `<svg>` 等节点的创建，需要对 `$$createElement` 方法进行 Hook。

在 kbone 官方文档 [DOM/BOM 扩展 API](https://github.com/wechat-miniprogram/kbone/blob/develop/docs/domextend.md) 一章中不难发现，我们可以使用 `window.$$addAspect` 函数对所需的方法进行 Hook：

```js
window.$$addAspect('document.$$createElement.after', (el) => {
  if (el.tagName.toLowerCase() === 'svg') {
    setTimeout(() => renderSvg(el), 0);
  }
});
```

在这里，我们监听了 `<svg>` 节点的建立，并在下一个宏任务中（即等待 `<svg>` 节点的所有子节点挂载完成后）调用我们自己的 `renderSvg()` 方法。在 `renderSvg()` 中，我们希望进行下列一些操作：

1. 首先分析并保存当前 SVG 文档中的所有 Symbol，以便于当前 SVG 文档内部或者其它 SVG 中使用；
2. 将当前 SVG 文档中的跨文档 `<use>` 节点替换成对应 Symbol 的 HTML，如果对应的 Symbol 还没有加载，则监听其加载完成；
3. 清理当前 SVG 文档，并转换为 `data:image/svg+xml` 格式的 Data URI；
4. 将当前 SVG 标记为已渲染，清除所有子节点，并将生成的 Data URI 设置为 CSS `background-image` 属性。

在并不知道 Symbol 是否可以再包含 `<use>` 的情况下，为了简化问题，我们可以先假设所有的 Symbol 中不会包含 `<use>`，即不存在 Symbol 之间多级依赖和循环依赖的情况。经过反复修改，`renderSvg()` 方法实现如下：

```js
const symbolMap = {};
const symbolUseMap = {};

const renderSvg = (el) => {
  // 如果之前已经完成渲染，就不重复渲染
  if (el.style.backgroundImage) return;

  // 分析并保存当前 SVG 文档中的所有 Symbol，以便于当前 SVG 文档内部或者其它 SVG 中使用
  // 同时，记录这些 Symbol，如果在当前 SVG 中本地使用，则不需要替换他们
  const localSymbols = new Set(el.querySelectorAll('symbol').map(resolveSymbol));

  // 先假设没有完成渲染
  let isFullRendered = true;

  // 将当前 SVG 文档中的跨文档 `<use>` 节点替换成对应 Symbol 的 HTML
  el.querySelectorAll('use').forEach(use => {
    const symbolId = (use.getAttribute('xlink:href') || use.getAttribute('data-xlink-href')).replace(/^#/, '');

    // 如果是当前文档内局部的 Symbol，不需要替换，background-image 会直接解析
    if (localSymbols.has(symbolId)) return;

    const symbol = symbolMap[symbolId];
    if (symbol) {
      // 如果对应的 Symbol 已经加载，将 <use> 替换成对应的 Symbol
      // 这里暂时简化考虑，直接覆盖 <use> 的父节点的所有内容
      const parentNode = use.parentNode;
      parentNode.innerHTML = symbol.innerHTML;
      parentNode.setAttribute('viewBox', symbol.getAttribute('viewBox'));

      if (!symbolUseMap[symbolId]) symbolUseMap[symbolId] = new Set();
      symbolUseMap[symbolId].delete(el);
    } else {
      // 如果对应的 Symbol 还没有加载，则监听其加载完成
      if (!symbolUseMap[symbolId]) symbolUseMap[symbolId] = new Set();
      symbolUseMap[symbolId].add(el);
      isFullRendered = false;
    }
  });

  // 若存在没加载完的 Symbol，先不执行渲染，因为渲染过程是一次性的，需要破坏所有子节点
  if (!isFullRendered) return;

  // 清理当前 SVG 文档，并转换为 `data:image/svg+xml` 格式的 Data URI
  let svg = el.outerHTML;
  const svgDataURI = parseSvgToDataURI(svg);
  const backgroundImage = `url('${svgDataURI}')`;

  if (backgroundImage.length > 5000) {
    console.error('[kbone-svg] SVG 长度超限', { svg, data: svgDataURI });
  }

  // 将当前 SVG 标记为已渲染，清除所有子节点，并将生成的 Data URI 设置为 CSS `background-image` 属性
  el.innerHTML = '';

  if (el.getAttribute('width')) el.style.width = el.getAttribute('width') + 'px';
  if (el.getAttribute('height')) el.style.height = el.getAttribute('height') + 'px';

  el.style.backgroundImage = backgroundImage;
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';

  console.log('[kbone-svg] 渲染 SVG 元素完成', { svg, data: svgDataURI });
}
```

接下来我们需要实现 resolveSymbol 方法。当遇到 Symbol 时，需要解析其 ID，保存该 Symbol 节点，并触发所有依赖当前 Symbol 的其他 SVG 的重新渲染。

```js
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
```

最后，我们需要定义 SVG 进行清理和渲染（转化为 Data URI）的过程。在此之前，需要对 setAttribute 和 setAttributeNS 进行一个 polyfill，因为 kbone 不支持为节点设置任意属性，很多属性设置之后会丢失。

```js
const _setAttribute = window.Element.prototype.setAttribute;
window.Element.prototype.setAttribute = function (attribute, value) {
  const oldHtml = this.outerHTML;
  _setAttribute.call(this, attribute, value);
  const newHtml = this.outerHTML;

  // 如果设置属性后 outerHTML 没有改变，则设置到 dataset 中
  if (oldHtml === newHtml) {
    this.dataset[attribute] = value;
  }
}

// 对设置 xlink:href 时可能出现的报错进行 polyfill，改为 data-xlink-href
window.Element.prototype.setAttributeNS = function (xmlns, attribute, value) {
  this.setAttribute('data-' + attribute.replace(':', '-'), value)
}
```

接下来即可定义 SVG 文档转化为 Data URI 的过程了，这里需要用到很多正则表达式。

```js
const parseSvgToDataURI = (svg) => {
  // 将被设置到 dataset 中的属性还原出来
  svg = svg.replace(/data-(.*?=(['"]).*?\2)/g, '$1');

  // 将被设置到 data-xlink-href 的属性还原出来
  svg = svg.replace(/xlink-href=/g, 'xlink:href=');

  // 将 dataset 中被变成 kebab-case 写法的 viewBox 还原出来
  svg = svg.replace(/view-box=/g, 'viewBox=');

  // 清除 SVG 中不应该显示的 title、desc、defs 元素
  svg = svg.replace(/<(title|desc|defs)>[\s\S]*?<\/\1>/g, '');

  // 为非标准 XML 的 SVG 添加 xmlns，防止视图层解析出错
  if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg/, "<svg xmlns='http://www.w3.org/2000/svg'");

  // 对 SVG 中出现的浮点数统一取最多两位小数，缓解数据量过大问题
  svg = svg.replace(/\d+\.\d+/g, (match) => parseFloat(parseFloat(match).toFixed(2)));

  // 清除注释，缓解数据量过大的问题
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');

  // 模拟 HTML 的 white-space 行为，将多个空格或换行符换成一个空格，减少数据量
  svg = svg.replace(/\s+/g, " ");

  // 对特殊符号进行转义，这里参考了 https://github.com/bhovhannes/svg-url-loader/blob/master/src/loader.js
  svg = svg.replace(/[{}\|\\\^~\[\]`"<>#%]/g, function (match) {
    return '%' + match[0].charCodeAt(0).toString(16).toUpperCase();
  });

  // 单引号替换为 \'，由于 kbone 的 bug，节点属性中的双引号在生成 outerHTML 时不会被转义导致出错
  // 因此 background-image: url( 后面只能跟单引号，所以生成的 URI 内部也就只能用斜杠转义单引号了
  svg = svg.replace(/'/g, "\\'");

  // 最后添加 mime 头部，变成 Webview 可以识别的 Data URI
  return 'data:image/svg+xml,' + svg.trim();
}
```

以上是经过反复 debug 后的相对稳定的代码。放在上文的演示项目中，效果如下图：

![image](https://user-images.githubusercontent.com/5051300/69700727-237c4e80-1126-11ea-9742-5124a7c5fc39.png)

可以看出，前两例中已经可以渲染出图片，第三例中，与 [MDN 官方文档的表现](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/symbol) 不太一致，经过检查，生成的 Data URI 直接打开并没有问题，可能是小程序视图层的环境对 SVG 内的尺寸换算存在问题。

在 Android 和 iOS 真机调试中，本例没有出现无法显示的兼容问题，这也说明了这种方案可行。

## 问题与总结

### kbone 解决了 JS 难题，却留下了 CSS 难题

在上述例子中可以看到，kbone 已经非常类似于 H5 的环境，但有一个很容易忽略的问题：由于实际的操作对象是 `<body>` 的虚拟 DOM，且小程序视图层并不支持 `<style>` ，**我们已经无法通过 JS 给整个页面（而非特定元素）注入 CSS**，因此也无法通过纯 JS 层面的 polyfill 来为 `svg` 等某一类元素定义一些优先级较低的默认样式。

例如，在解析 SVG 的过程中，我们可能希望通过获取 SVG 元素的尺寸来设置渲染后背景图的默认尺寸（像 `<img>` 那样），同时允许来自业务代码中的尺寸覆盖，这在 kbone 环境下，甚至也许在小程序架构中是不可能的——除非我们利用 Webpack 的黑魔法将自己的 polyfill 编译到 WXSS 中去，或者如果你有超人的胆量和气魄，也可以给你迁移过来的业务代码中要覆盖你的样式批量加上 `!important`。

同理，可以肯定的是，我们也无法在 JS 中控制诸如媒体查询、字体定义、动画定义、以及 `::before`、`::after` 伪元素的展示行为等，这些都是只能通过静态 WXSS 编译到小程序包内，而无法通过小程序 JS 动态加载的。

### 数据量消耗

另外，虽然在 HTML5 环境中十分推崇 SVG 格式，但放在 kbone 的特定环境下，把 SVG 转换成 CSS `background-image` 反而是一种不甚考究的方案，因为这将会占用 `setData()`（小程序基础库中称为 `vdSyncBatch`）的数据量，降低数据层和视图层之间通信的效率，不过好在每个 SVG 图片只会被传输一次。

在写这个项目的同时，我也尝试将经过清理后生成的 SVG 利用小程序接口保存到本地文件，然后将文件的虚拟 URL 交给视图层，结果并不乐观。视图层在向微信 JSSDK 请求该 SVG 文件的过程中，也许因为没有收到 Content-Type 或者收到的 Content-Type 不对，导致 SVG 文件无法被正确解析展示出来。这可能是小程序的 Bug，或者也许是小程序并没有打算支持的灰色地带。

### 小结

尽管依然存在诸多问题，通过一个 polyfill 来为项目迁移过程中遇到的 SVG 提供一个临时展示方案仍然是有必要的——这让我们可以先搁置图片格式的问题，将更重要的问题处理完之后，再回来批量转换格式、或改用 Canvas 来绘制。

文中完成的 kbone SVG polyfill 只有一个 JS 文件，托管在我个人的 [GitHub](https://github.com/rikumi/kbone-svg)，同时为了方便使用也发布到 [NPM](https://www.npmjs.com/kbone-svg)。本文存在很多主观推测和评论，如有谬误，欢迎留言指正。

![](https://img.shields.io/npm/v/kbone-svg) ![](https://img.shields.io/github/last-commit/rikumi/kbone-svg)
