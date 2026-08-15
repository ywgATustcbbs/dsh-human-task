// human-task — Client half (DeepSeek Harness dynamic Cordis Plugin function body).
// Load this exact text as `code.client` in `cordis_define`.
//
// Renders the consent / AFK / task dialogs in `shell.overlay`.
// Reads the Harness locale (zh/en) and theme (light/dark) at runtime.
// Plays a Web Audio "ding" on each new dialog and offers a mute toggle (persisted on the Host).
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const h = React.createElement

    const T = {
      zh: {
        consentTitle: 'Agent 请求人工协助',
        consentQuestion: '是否同意在本会话中接收人工协助请求？',
        consentHint: '无响应将默认拒绝。',
        agree: '同意',
        decline: '拒绝',
        denyAll: '拒绝后续所有协助',
        afkTitle: 'AFK 检查',
        afkQuestion: '你还在吗？',
        afkHint: '如果没有响应，将认为你暂时离开 (AFK)。',
        present: '在（继续）',
        taskTitle: '人工任务 (Human Task)',
        titlePrefix: '标题: ',
        instructionsLabel: '请执行 (Instructions)',
        successPrefix: '成功条件: ',
        feedbackPrefix: '反馈要求: ',
        defaultCondition: '完成后请输入结果；如果失败，请描述问题。',
        feedbackLabel: '反馈 (Feedback)',
        placeholder: '输入结果或失败描述…',
        done: '完成 (成功)',
        partial: '部分失败',
        failed: '失败',
        cancel: '取消',
        extend: '延长时间',
        extend5: '延长 5 分钟',
        extend10: '延长 10 分钟',
        extend15: '延长 15 分钟',
        timerPrefix: '剩余时间: ',
        close: '关闭',
        noInstructions: '（无具体步骤）',
        fbSuccess: '完成',
        fbPartial: '部分完成',
        fbFailed: '失败',
        mute: '静音',
        unmute: '取消静音'
      },
      en: {
        consentTitle: 'Agent requests human assistance',
        consentQuestion: 'Allow human-assistance requests in this session?',
        consentHint: 'No response will be treated as a refusal.',
        agree: 'Agree',
        decline: 'Decline',
        denyAll: 'Decline all future assistance',
        afkTitle: 'AFK check',
        afkQuestion: 'Are you still there?',
        afkHint: 'No response will be treated as away (AFK).',
        present: 'Still here (continue)',
        taskTitle: 'Human Task',
        titlePrefix: 'Title: ',
        instructionsLabel: 'Instructions',
        successPrefix: 'Success condition: ',
        feedbackPrefix: 'Feedback request: ',
        defaultCondition: 'Enter the result when done; if it failed, describe the problem.',
        feedbackLabel: 'Feedback',
        placeholder: 'Enter the result or a failure description…',
        done: 'Done (success)',
        partial: 'Partial failure',
        failed: 'Failed',
        cancel: 'Cancel',
        extend: 'Extend time',
        extend5: 'Extend 5 min',
        extend10: 'Extend 10 min',
        extend15: 'Extend 15 min',
        timerPrefix: 'Time remaining: ',
        close: 'Close',
        noInstructions: '(No specific steps)',
        fbSuccess: 'Done',
        fbPartial: 'Partially completed',
        fbFailed: 'Failed',
        mute: 'Mute',
        unmute: 'Unmute'
      }
    }

    function t(lang, key) {
      const dict = T[lang] || T.zh
      if (dict[key] !== undefined) return dict[key]
      if (T.zh[key] !== undefined) return T.zh[key]
      return key
    }

    function defaultFeedback(lang, action) {
      if (action === 'success') return t(lang, 'fbSuccess')
      if (action === 'partial') return t(lang, 'fbPartial')
      if (action === 'failed') return t(lang, 'fbFailed')
      return ''
    }

    // ---- 提示音（Web Audio 播放 assets/notification.wav，失败回退合成「叮」） ----
    // 状态放 globalThis 单例：更新后残留的旧客户端实例与当前实例共享同一份
    // 音频上下文和去重键，避免同一个弹窗被两个实例各播一次（双响）。
    const gRoot = (typeof globalThis !== 'undefined') ? globalThis : ((typeof window !== 'undefined') ? window : {})
    const g = (gRoot.__humanTaskAudio = gRoot.__humanTaskAudio || {})
    g.instances = (g.instances || 0) + 1

    function decodeAndStore(base64) {
      try {
        const bin = atob(base64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
        const AC = (typeof AudioContext !== 'undefined') ? AudioContext : ((typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null)
        if (!AC) return
        if (!g.audioCtx) g.audioCtx = new AC()
        const p = g.audioCtx.decodeAudioData(bytes.buffer)
        if (p && typeof p.then === 'function') {
          p.then((buffer) => { g.audioBuffer = buffer; host.call('humanTask.diag', { e: 'decoded' }).catch(() => {}) }).catch(() => { host.call('humanTask.diag', { e: 'decode-fail' }).catch(() => {}) })
        }
      } catch (e) { host.call('humanTask.diag', { e: 'decode-throw' }).catch(() => {}) }
    }

    function loadSound() {
      if (g.soundLoaded) return
      g.soundLoaded = true
      host.call('humanTask.sound').then((r) => {
        if (r && typeof r.base64 === 'string' && r.base64) decodeAndStore(r.base64)
      }).catch(() => {})
    }

    function beep() {
      const nowTs = Date.now()
      if (nowTs - (g.lastBeepAt || 0) < 500) return
      g.lastBeepAt = nowTs
      host.call('humanTask.diag', { e: 'beep', hb: !!g.audioBuffer, st: g.audioCtx ? g.audioCtx.state : 'none' }).catch(() => {})
      try {
        const AC = (typeof AudioContext !== 'undefined') ? AudioContext : ((typeof webkitAudioContext !== 'undefined') ? webkitAudioContext : null)
        if (!AC) return
        if (!g.audioCtx) g.audioCtx = new AC()
        const play = () => {
          if (g.audioBuffer) {
            host.call('humanTask.diag', { e: 'play-buffer', st: g.audioCtx ? g.audioCtx.state : 'none' }).catch(() => {})
            const src = g.audioCtx.createBufferSource()
            src.buffer = g.audioBuffer
            src.connect(g.audioCtx.destination)
            src.start(0)
          } else {
            host.call('humanTask.diag', { e: 'play-osc', st: g.audioCtx ? g.audioCtx.state : 'none' }).catch(() => {})
            const now = g.audioCtx.currentTime
            const osc = g.audioCtx.createOscillator()
            const gain = g.audioCtx.createGain()
            osc.type = 'sine'
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.0001, now)
            gain.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
            osc.connect(gain)
            gain.connect(g.audioCtx.destination)
            osc.start(now)
            osc.stop(now + 0.2)
          }
        }
        if (g.audioCtx.state === 'suspended') {
          g.audioCtx.resume().then(play).catch(() => { host.call('humanTask.diag', { e: 'resume-fail' }).catch(() => {}) })
        } else {
          play()
        }
      } catch (e) { host.call('humanTask.diag', { e: 'beep-throw' }).catch(() => {}) }
    }
    ctx.effect(() => () => {
      g.instances = Math.max(0, (g.instances || 1) - 1)
      if (g.instances === 0) {
        if (g.audioCtx) { try { g.audioCtx.close() } catch (e) {} }
        g.audioCtx = null; g.audioBuffer = null; g.soundLoaded = false; g.lastBeepAt = 0; g.lastBeepedId = null
      }
    })

    function makeStyles(dark) {
      const c = dark ? {
        overlay: '#171a1f',
        layer1: '#21252c',
        labelPrimary: '#e6e8eb',
        labelSecondary: '#9aa0a6',
        borderL1: '#2c313a',
        borderL2: '#3b424c',
        primaryBg: '#1f3a5f',
        primaryText: '#e8f1ff',
        primaryBorder: '#2f5279',
        error: '#ff8080',
        warn: '#ffc069'
      } : {
        overlay: '#ffffff',
        layer1: '#f6f8fa',
        labelPrimary: '#1f2328',
        labelSecondary: '#57606a',
        borderL1: '#e5e7eb',
        borderL2: '#d1d5db',
        primaryBg: '#2563eb',
        primaryText: '#ffffff',
        primaryBorder: '#2563eb',
        error: '#b91c1c',
        warn: '#b45309'
      }
      return {
        backdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, pointerEvents: 'auto', padding: 12 },
        card: { background: c.overlay, color: c.labelPrimary, borderRadius: 12, width: 620, maxWidth: '96vw', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 10px 48px rgba(0,0,0,0.45)', fontFamily: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif', display: 'flex', flexDirection: 'column' },
        header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid ' + c.borderL1 },
        headerTitle: { fontSize: 16, fontWeight: 700, margin: 0 },
        headerRight: { display: 'flex', alignItems: 'center', gap: 2 },
        close: { border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: c.labelSecondary, padding: '4px 8px' },
        muteBtn: { border: 'none', background: 'transparent', fontSize: 16, lineHeight: 1, cursor: 'pointer', color: c.labelSecondary, padding: '4px 8px' },
        body: { padding: '16px 18px' },
        sectionTitle: { fontSize: 13, fontWeight: 700, color: c.labelPrimary, margin: '0 0 6px' },
        pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: c.layer1, border: '1px solid ' + c.borderL1, borderRadius: 8, padding: 10, margin: '0 0 12px', fontSize: 13, maxHeight: 220, overflow: 'auto', color: c.labelPrimary },
        cond: { whiteSpace: 'pre-wrap', fontSize: 13, color: c.labelSecondary, margin: '0 0 12px' },
        timer: { fontSize: 14, fontWeight: 700, color: c.error, margin: '0 0 10px' },
        textarea: { width: '100%', minHeight: 110, boxSizing: 'border-box', resize: 'vertical', border: '1px solid ' + c.borderL2, borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'inherit', background: c.layer1, color: c.labelPrimary },
        row: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
        btn: { border: '1px solid ' + c.borderL2, background: c.layer1, color: c.labelPrimary, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
        primary: { border: '1px solid ' + c.primaryBorder, background: c.primaryBg, color: c.primaryText, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 },
        warn: { border: '1px solid ' + c.error, background: 'transparent', color: c.error, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
        select: { border: '1px solid ' + c.warn, background: c.layer1, color: c.warn, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
        msg: { fontSize: 14, lineHeight: 1.6 }
      }
    }

    function fmtClock(seconds) {
      const s = Math.max(0, Math.floor(seconds))
      const m = Math.floor(s / 60)
      const sec = s % 60
      return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec
    }

    function useLang() {
      const locale = ctx.get('locale')
      const readLang = () => {
        if (!locale) return 'zh'
        try {
          const snap = typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : (typeof locale.getLocale === 'function' ? locale.getLocale() : null)
          return (snap && snap.active === 'en') ? 'en' : 'zh'
        } catch (e) { return 'zh' }
      }
      const [lang, setLang] = React.useState(readLang)
      React.useEffect(() => {
        if (!locale || typeof locale.subscribe !== 'function') return
        const unsub = locale.subscribe(() => setLang(readLang()))
        return unsub
      }, [])
      return lang
    }

    function useTheme() {
      const theme = ctx.get('theme')
      const readDark = () => {
        if (!theme) return false
        try {
          const snap = theme.getTheme()
          return !!(snap && snap.active && snap.active.colorScheme === 'dark')
        } catch (e) { return false }
      }
      const [dark, setDark] = React.useState(readDark)
      React.useEffect(() => {
        const off = ctx.on('theme/change', (snap) => {
          setDark(!!(snap && snap.active && snap.active.colorScheme === 'dark'))
        })
        return off
      }, [])
      return dark
    }

    function useCountdown(deadlineAt, onExpire) {
      const [remaining, setRemaining] = React.useState(() => Math.max(0, Math.round((deadlineAt - Date.now()) / 1000)))
      const onExpireRef = React.useRef(onExpire)
      onExpireRef.current = onExpire
      const firedRef = React.useRef(false)
      React.useEffect(() => {
        firedRef.current = false
        const cancel = ctx.interval(() => {
          const rem = Math.max(0, Math.round((deadlineAt - Date.now()) / 1000))
          setRemaining(rem)
          if (rem <= 0 && !firedRef.current) {
            firedRef.current = true
            onExpireRef.current()
          }
        }, 1000)
        return cancel
      }, [deadlineAt])
      return remaining
    }

    function submit(interaction, action, feedback, extra) {
      return host.call('humanTask.submit', Object.assign({ id: interaction.id, action: action, feedback: feedback || '' }, extra || {}))
    }

    function MuteButton(props) {
      const muted = props.muted
      const lang = props.lang
      const S = props.S
      const label = muted ? t(lang, 'unmute') : t(lang, 'mute')
      return h('button', {
        style: S.muteBtn,
        onClick: props.onToggleMute,
        'aria-label': label,
        title: label
      }, muted ? '🔇' : '🔊')
    }

    function ConsentDialog(props) {
      const it = props.interaction
      const lang = props.lang
      const S = props.S
      const remaining = useCountdown(it.deadlineAt, () => submit(it, 'timeout', ''))
      return h('div', { style: S.backdrop },
        h('div', { style: S.card },
          h('div', { style: S.header },
            h('div', { style: S.headerTitle }, t(lang, 'consentTitle')),
            h('div', { style: S.headerRight },
              h(MuteButton, { muted: props.muted, lang: lang, S: S, onToggleMute: props.onToggleMute }),
              h('button', { style: S.close, onClick: () => submit(it, 'window_closed', ''), 'aria-label': t(lang, 'close') }, '×')
            )
          ),
          h('div', { style: S.body },
            h('p', { style: S.msg }, t(lang, 'consentQuestion')),
            h('p', { style: S.msg }, t(lang, 'consentHint')),
            h('div', { style: S.timer }, t(lang, 'timerPrefix') + fmtClock(remaining)),
            h('div', { style: S.row },
              h('button', { style: S.primary, onClick: () => submit(it, 'granted', '') }, t(lang, 'agree')),
              h('button', { style: S.btn, onClick: () => submit(it, 'declined', '') }, t(lang, 'decline')),
              h('button', { style: S.warn, onClick: () => submit(it, 'deny_all', '') }, t(lang, 'denyAll'))
            )
          )
        )
      )
    }

    function AfkDialog(props) {
      const it = props.interaction
      const lang = props.lang
      const S = props.S
      const remaining = useCountdown(it.deadlineAt, () => submit(it, 'timeout', ''))
      return h('div', { style: S.backdrop },
        h('div', { style: S.card },
          h('div', { style: S.header },
            h('div', { style: S.headerTitle }, t(lang, 'afkTitle')),
            h('div', { style: S.headerRight },
              h(MuteButton, { muted: props.muted, lang: lang, S: S, onToggleMute: props.onToggleMute }),
              h('button', { style: S.close, onClick: () => submit(it, 'window_closed', ''), 'aria-label': t(lang, 'close') }, '×')
            )
          ),
          h('div', { style: S.body },
            h('p', { style: S.msg }, t(lang, 'afkQuestion')),
            h('p', { style: S.msg }, t(lang, 'afkHint')),
            h('div', { style: S.timer }, t(lang, 'timerPrefix') + fmtClock(remaining)),
            h('div', { style: S.row },
              h('button', { style: S.primary, onClick: () => submit(it, 'present', '') }, t(lang, 'present')),
              h('button', { style: S.warn, onClick: () => submit(it, 'deny_all', '') }, t(lang, 'denyAll'))
            )
          )
        )
      )
    }

    function TaskDialog(props) {
      const it = props.interaction
      const lang = props.lang
      const S = props.S
      const f = it.fields || {}
      const [deadlineAt, setDeadlineAt] = React.useState(it.deadlineAt)
      const [feedback, setFeedback] = React.useState('')
      const [extendValue, setExtendValue] = React.useState('')
      const doSubmit = (action) => {
        const fb = feedback.trim()
        const finalFb = fb.length > 0 ? feedback : defaultFeedback(lang, action)
        submit(it, action, finalFb)
      }
      const remaining = useCountdown(deadlineAt, () => doSubmit('timeout'))

      const inst = Array.isArray(f.instructions) ? f.instructions : []
      const instText = inst.length === 0 ? t(lang, 'noInstructions') : inst.map((s, i) => (i + 1) + '. ' + s).join('\n')
      let cond = ''
      if (f.success_condition) cond += t(lang, 'successPrefix') + f.success_condition
      if (f.feedback_request) { if (cond) cond += '\n'; cond += t(lang, 'feedbackPrefix') + f.feedback_request }
      if (!cond) cond = t(lang, 'defaultCondition')

      const onExtend = (minutes) => {
        submit(it, 'extend', '', { minutes: minutes }).then((r) => {
          if (r && r.ok && typeof r.deadlineAt === 'number') setDeadlineAt(r.deadlineAt)
        })
      }

      return h('div', { style: S.backdrop },
        h('div', { style: S.card },
          h('div', { style: S.header },
            h('div', { style: S.headerTitle }, t(lang, 'taskTitle')),
            h('div', { style: S.headerRight },
              h(MuteButton, { muted: props.muted, lang: lang, S: S, onToggleMute: props.onToggleMute }),
              h('button', { style: S.close, onClick: () => doSubmit('window_closed'), 'aria-label': t(lang, 'close') }, '×')
            )
          ),
          h('div', { style: S.body },
            h('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 12 } }, t(lang, 'titlePrefix') + String(f.title || '')),
            h('div', { style: S.sectionTitle }, t(lang, 'instructionsLabel')),
            h('pre', { style: S.pre }, instText),
            h('pre', { style: S.cond }, cond),
            h('div', { style: S.timer }, t(lang, 'timerPrefix') + fmtClock(remaining)),
            h('div', { style: S.sectionTitle }, t(lang, 'feedbackLabel')),
            h('textarea', { style: S.textarea, value: feedback, onChange: (e) => setFeedback(e.target.value), placeholder: t(lang, 'placeholder') }),
            h('div', { style: S.row },
              h('button', { style: S.primary, onClick: () => doSubmit('success') }, t(lang, 'done')),
              h('button', { style: S.btn, onClick: () => doSubmit('partial') }, t(lang, 'partial')),
              h('button', { style: S.btn, onClick: () => doSubmit('failed') }, t(lang, 'failed')),
              h('button', { style: S.btn, onClick: () => doSubmit('cancelled') }, t(lang, 'cancel')),
              h('select', { value: extendValue, onChange: (e) => { const v = e.target.value; setExtendValue(''); if (v) onExtend(parseInt(v, 10)) }, style: S.select },
                h('option', { value: '', disabled: true }, t(lang, 'extend')),
                h('option', { value: '5' }, t(lang, 'extend5')),
                h('option', { value: '10' }, t(lang, 'extend10')),
                h('option', { value: '15' }, t(lang, 'extend15'))
              ),
              h('button', { style: S.warn, onClick: () => doSubmit('deny_all') }, t(lang, 'denyAll'))
            )
          )
        )
      )
    }

    function HumanTaskOverlay() {
      const lang = useLang()
      const dark = useTheme()
      const S = makeStyles(dark)
      const [interaction, setInteraction] = React.useState(null)
      const [muted, setMuted] = React.useState(false)

      React.useEffect(() => {
        host.call('humanTask.getMute').then((r) => {
          if (r && typeof r.muted === 'boolean') setMuted(r.muted)
        }).catch(() => {})
      }, [])

      React.useEffect(() => {
        loadSound()
        let stopped = false
        let polling = false
        async function tick() {
          if (polling) return
          polling = true
          try {
            const cur = await host.call('humanTask.poll')
            if (stopped) return
            if (cur) {
              setInteraction(cur.interaction || null)
              if (typeof cur.muted === 'boolean') setMuted(cur.muted)
            } else {
              setInteraction(null)
            }
          } catch (e) {} finally { polling = false }
        }
        tick()
        const cancel = ctx.interval(tick, 900)
        return () => { stopped = true; cancel() }
      }, [])

      React.useEffect(() => {
        if (!interaction || interaction.id === g.lastBeepedId) return
        g.lastBeepedId = interaction.id
        if (muted) return
        beep()
      }, [interaction, muted])

      const toggleMute = () => {
        const next = !muted
        setMuted(next)
        host.call('humanTask.setMute', { muted: next }).catch(() => {})
      }

      let dialog = null
      if (interaction) {
        if (interaction.kind === 'consent') dialog = h(ConsentDialog, { interaction: interaction, lang: lang, S: S, muted: muted, onToggleMute: toggleMute })
        else if (interaction.kind === 'afk') dialog = h(AfkDialog, { interaction: interaction, lang: lang, S: S, muted: muted, onToggleMute: toggleMute })
        else if (interaction.kind === 'task') dialog = h(TaskDialog, { interaction: interaction, lang: lang, S: S, muted: muted, onToggleMute: toggleMute })
      }

      return dialog
    }

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'human-task-overlay', order: 1000 },
      () => h(HumanTaskOverlay)
    ))
  }
}
