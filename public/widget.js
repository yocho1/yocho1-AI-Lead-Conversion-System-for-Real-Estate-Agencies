;(function () {
  if (window.AIWidget) {
    return
  }

  var DEFAULT_COLOR = '#0f766e'
  var DEFAULT_TITLE = 'Property Assistant'

  function createEl(tag, style) {
    var el = document.createElement(tag)
    if (style) {
      Object.assign(el.style, style)
    }
    return el
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 767px)').matches
  }

  function safeColor(value) {
    if (typeof value !== 'string') return DEFAULT_COLOR
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return DEFAULT_COLOR
    return value
  }

  function init(config) {
    if (!config || !config.agencyKey) {
      console.error('AIWidget: missing agencyKey')
      return
    }

    var baseUrl =
      config.baseUrl || window.AI_WIDGET_BASE_URL || window.location.origin
    var agencyKey = String(config.agencyKey)

    var state = {
      opened: false,
      loaded: false,
      brand: {
        name: DEFAULT_TITLE,
        primaryColor: DEFAULT_COLOR,
        logo: null,
      },
    }

    var button = createEl('button', {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      width: '60px',
      height: '60px',
      borderRadius: '999px',
      border: '0',
      zIndex: '9999',
      cursor: 'pointer',
      color: '#fff',
      fontSize: '26px',
      boxShadow: '0 10px 25px rgba(0,0,0,.25)',
      transition: 'transform .18s ease, box-shadow .18s ease, opacity .2s ease',
      background: state.brand.primaryColor,
      opacity: '0.96',
    })
    button.type = 'button'
    button.setAttribute('aria-label', 'Open AI chat')
    button.textContent = '💬'

    button.addEventListener('mouseenter', function () {
      button.style.transform = 'translateY(-2px) scale(1.04)'
      button.style.boxShadow = '0 14px 30px rgba(0,0,0,.28)'
    })
    button.addEventListener('mouseleave', function () {
      button.style.transform = 'translateY(0) scale(1)'
      button.style.boxShadow = '0 10px 25px rgba(0,0,0,.25)'
    })

    var panel = createEl('div', {
      position: 'fixed',
      right: '20px',
      bottom: '92px',
      width: '390px',
      maxWidth: 'calc(100vw - 24px)',
      height: '560px',
      maxHeight: 'calc(100vh - 110px)',
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(0,0,0,.24)',
      zIndex: '9999',
      border: '1px solid #d9e2ef',
      display: 'none',
      transform: 'translateY(8px)',
      transition: 'transform .2s ease, opacity .2s ease',
      opacity: '0',
    })

    var header = createEl('div', {
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      color: '#fff',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      background: state.brand.primaryColor,
    })

    var titleWrap = createEl('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: '0',
    })
    var logo = createEl('img', {
      width: '22px',
      height: '22px',
      borderRadius: '6px',
      objectFit: 'cover',
      display: 'none',
      background: 'rgba(255,255,255,.16)',
    })
    var title = createEl('div', {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '280px',
    })
    title.textContent = state.brand.name
    titleWrap.appendChild(logo)
    titleWrap.appendChild(title)

    var closeBtn = createEl('button', {
      border: '0',
      background: 'transparent',
      color: '#fff',
      fontSize: '22px',
      lineHeight: '1',
      cursor: 'pointer',
      width: '34px',
      height: '34px',
      borderRadius: '8px',
    })
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close AI chat')
    closeBtn.textContent = '×'

    var frame = createEl('iframe', {
      border: '0',
      width: '100%',
      height: 'calc(100% - 52px)',
      background: '#fff',
    })
    frame.title = 'AI Lead Chat Widget'

    header.appendChild(titleWrap)
    header.appendChild(closeBtn)
    panel.appendChild(header)
    panel.appendChild(frame)

    function updateBrand(brand) {
      state.brand.name = brand.name || DEFAULT_TITLE
      state.brand.primaryColor = safeColor(brand.primaryColor)
      state.brand.logo = brand.logo || null

      button.style.background = state.brand.primaryColor
      header.style.background = state.brand.primaryColor
      title.textContent = state.brand.name

      if (state.brand.logo) {
        logo.src = state.brand.logo
        logo.style.display = 'block'
      } else {
        logo.removeAttribute('src')
        logo.style.display = 'none'
      }
    }

    function loadFrameOnce() {
      if (state.loaded) return
      var src =
        baseUrl +
        '/?agencyKey=' +
        encodeURIComponent(agencyKey) +
        '&embedded=true' +
        (agencyKey === 'demo-agency-key' ? '&demo=true' : '')
      frame.src = src
      state.loaded = true
    }

    function applyMobileMode() {
      if (isMobile()) {
        panel.style.right = '0'
        panel.style.bottom = '0'
        panel.style.width = '100vw'
        panel.style.height = '100vh'
        panel.style.maxWidth = '100vw'
        panel.style.maxHeight = '100vh'
        panel.style.borderRadius = '0'
      } else {
        panel.style.right = '20px'
        panel.style.bottom = '92px'
        panel.style.width = '390px'
        panel.style.height = '560px'
        panel.style.maxWidth = 'calc(100vw - 24px)'
        panel.style.maxHeight = 'calc(100vh - 110px)'
        panel.style.borderRadius = '16px'
      }
    }

    function openPanel() {
      loadFrameOnce()
      applyMobileMode()
      panel.style.display = 'block'
      requestAnimationFrame(function () {
        panel.style.opacity = '1'
        panel.style.transform = 'translateY(0)'
      })
      state.opened = true
    }

    function closePanel() {
      panel.style.opacity = '0'
      panel.style.transform = 'translateY(8px)'
      setTimeout(function () {
        if (!state.opened) {
          panel.style.display = 'none'
        }
      }, 180)
      state.opened = false
    }

    function togglePanel() {
      if (state.opened) {
        closePanel()
      } else {
        openPanel()
      }
    }

    button.addEventListener('click', togglePanel)
    closeBtn.addEventListener('click', closePanel)
    window.addEventListener('resize', function () {
      if (state.opened) {
        applyMobileMode()
      }
    })

    document.body.appendChild(button)
    document.body.appendChild(panel)

    fetch(baseUrl + '/api/agency/' + encodeURIComponent(agencyKey), {
      method: 'GET',
      credentials: 'omit',
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('invalid_agency')
        }
        return res.json()
      })
      .then(function (data) {
        updateBrand({
          name: data.name || DEFAULT_TITLE,
          primaryColor: data.primaryColor || DEFAULT_COLOR,
          logo: data.logo || null,
        })
      })
      .catch(function () {
        button.style.opacity = '0.65'
        button.title = 'Widget unavailable'
      })
  }

  window.AIWidget = {
    init: function (config) {
      var run = function () {
        init(config || {})
      }

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 1400 })
      } else {
        window.setTimeout(run, 120)
      }
    },
  }
})()
