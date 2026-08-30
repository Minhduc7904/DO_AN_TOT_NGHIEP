(() => {
  'use strict';

  const dataElement = document.getElementById('project-data');
  const viewport = document.getElementById('timeline-viewport');
  const canvas = document.getElementById('timeline-canvas');
  const phaseLayer = document.getElementById('phase-layer');
  const nodeLayer = document.getElementById('node-layer');
  const connectorLayer = document.getElementById('connector-layer');
  const detailCard = document.getElementById('detail-card');
  const minimap = document.getElementById('minimap');
  const minimapTrack = document.getElementById('minimap-track');
  const minimapWindow = document.getElementById('minimap-window');
  const positionLabel = document.getElementById('position-label');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let project;
  try {
    project = JSON.parse(dataElement.textContent);
  } catch (error) {
    document.body.innerHTML = '<p style="padding:2rem">Không đọc được dữ liệu timeline. Hãy chạy script đồng bộ.</p>';
    throw error;
  }

  if (!Array.isArray(project.weeks) || project.weeks.length !== 24) {
    document.body.innerHTML = '<p style="padding:2rem">Timeline chưa có dữ liệu hợp lệ. Hãy chạy tools/sync-plan-json-and-timeline.ps1.</p>';
    return;
  }

  const config = {
    sidePadding: 230,
    weekWidth: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--week-width')) || 330,
    axisY: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--axis-y')) || 390,
    taskStep: 82,
    taskSpread: 104
  };
  const statusColors = {
    'Chưa bắt đầu': '#71869f',
    'Chưa phân công': '#71869f',
    'Đã giao': '#6c9cff',
    'Đang thực hiện': '#4ee3ff',
    'Chờ xử lý': '#ffc968',
    'Chờ review': '#ffad66',
    'Hoàn thành': '#4ce6a0'
  };
  const phaseColors = ['#4ee3ff', '#5d8dff', '#7e75ff', '#ae70ff', '#e56ac1', '#ff9770', '#ffd06d'];
  const nodeElements = new Map();
  const connectorElements = new Map();
  let pinnedNode = null;
  let hoveredNode = null;
  let dragState = null;
  let momentumFrame = null;

  const fmtDate = (iso) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const colorFor = (status) => statusColors[status] || '#71869f';

  document.getElementById('project-summary').textContent = project.project.description;
  document.getElementById('generated-at').textContent = `Đồng bộ ${new Date(project.generatedAt).toLocaleString('vi-VN')}`;

  function weekX(number) {
    return config.sidePadding + config.weekWidth + (number - 1) * config.weekWidth;
  }

  function createButton(className, x, y, label, data, nodeId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `timeline-node ${className}`;
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.style.setProperty('--node-color', colorFor(data.status));
    button.setAttribute('aria-label', label);
    button.dataset.nodeId = nodeId;
    button._timelineData = data;
    nodeElements.set(nodeId, button);
    return button;
  }

  function renderPhases() {
    project.phases.forEach((phase, index) => {
      const band = document.createElement('div');
      band.className = 'phase-band';
      const left = weekX(phase.startWeek) - config.weekWidth / 2;
      const width = (phase.endWeek - phase.startWeek + 1) * config.weekWidth;
      band.style.left = `${left}px`;
      band.style.width = `${width}px`;
      band.style.setProperty('--phase-color', `${phaseColors[index]}12`);
      const label = document.createElement('span');
      label.className = 'phase-label';
      label.textContent = `Giai đoạn ${String(index).padStart(2, '0')} · ${phase.title}`;
      band.appendChild(label);
      phaseLayer.appendChild(band);

      const segment = document.createElement('span');
      segment.className = 'minimap-segment';
      segment.style.flex = String(phase.endWeek - phase.startWeek + 1);
      segment.style.background = phaseColors[index];
      segment.title = phase.title;
      minimapTrack.appendChild(segment);
    });
  }

  function renderEndpoint(kind, x) {
    const isStart = kind === 'start';
    const endpoint = createButton(`endpoint-node ${kind}`, x, config.axisY, isStart ? 'Bắt đầu dự án' : 'Kết thúc dự án', {
      type: 'endpoint',
      title: isStart ? 'Bắt đầu hành trình' : 'Hoàn tất hành trình',
      status: isStart ? 'Hoàn thành' : 'Chưa bắt đầu',
      description: isStart ? `Khởi động ngày ${fmtDate(project.schedule.startDate)}` : `Mốc kết thúc kế hoạch ngày ${fmtDate(project.schedule.endDate)}`
    }, kind);
    endpoint.innerHTML = `<span class="node-orb"><span class="endpoint-icon">${isStart ? '◈' : '✦'}</span></span><span class="endpoint-label">${isStart ? 'Bắt đầu' : 'Kết thúc'}</span>`;
    nodeLayer.appendChild(endpoint);
  }

  function renderWeek(week) {
    const x = weekX(week.number);
    const weekNode = createButton('week-node', x, config.axisY, `Tuần ${week.number}: ${week.title}`, { ...week, type: 'week' }, week.id);
    const milestone = project.milestones.find((item) => item.week === week.number);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const isCurrent = today >= week.startDate && today <= week.endDate;
    if (isCurrent) weekNode.classList.add('current-week');
    weekNode.innerHTML = `
      <span class="node-orb">
        ${milestone ? `<span class="milestone-badge">${escapeHtml(milestone.id.toUpperCase())}</span>` : ''}
        <span class="week-number">${String(week.number).padStart(2, '0')}</span>
        <span class="week-word">Tuần</span>
      </span>
      <span class="week-caption">${escapeHtml(week.title)}<span class="week-date">${fmtDate(week.startDate)} — ${fmtDate(week.endDate)}</span></span>`;
    nodeLayer.appendChild(weekNode);

    week.tasks.forEach((task, index) => {
      const above = index % 2 === 0;
      const lane = Math.floor(index / 2);
      const offsetX = (lane - (Math.max(0, Math.ceil(week.tasks.length / 2) - 1) / 2)) * config.taskStep;
      const taskX = x + offsetX;
      const taskY = config.axisY + (above ? -1 : 1) * (config.taskSpread + lane * 9);
      const nodeId = `${week.id}:${task.id}`;
      const taskNode = createButton(`task-node ${above ? 'is-above' : 'is-below'}`, taskX, taskY, `${task.id}: ${task.title}`, { ...task, type: 'task', week }, nodeId);
      taskNode.innerHTML = `<span class="node-orb"></span><span class="task-caption">${escapeHtml(task.title)}</span>`;
      nodeLayer.appendChild(taskNode);
      createConnector(nodeId, x, config.axisY, taskX, taskY, above);
    });
  }

  function createConnector(nodeId, sourceX, sourceY, targetX, targetY, above) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const curve = Math.abs(targetY - sourceY) * .52;
    const d = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + (above ? -curve : curve)}, ${targetX} ${targetY + (above ? curve : -curve)}, ${targetX} ${targetY}`;
    path.setAttribute('d', d);
    path.setAttribute('class', 'connector');
    path.dataset.nodeId = nodeId;
    connectorLayer.appendChild(path);
    connectorElements.set(nodeId, path);
  }

  function detailSections(data) {
    if (data.type === 'endpoint') {
      return `<section class="detail-section"><p>${escapeHtml(data.description)}</p></section>`;
    }
    if (data.type === 'week') {
      const goals = data.planGoals?.length ? `<section class="detail-section"><h3>Mục tiêu</h3><ul>${data.planGoals.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : '';
      const deliverables = data.deliverables?.length ? `<section class="detail-section"><h3>Bàn giao</h3><ul>${data.deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : '';
      const streams = data.workstreams?.length ? `<section class="detail-section"><h3>Phân vai</h3>${data.workstreams.map((stream) => `<p><strong>${escapeHtml(stream.owner)}</strong> · ${escapeHtml(stream.title)}: ${escapeHtml(stream.items.join('; '))}</p>`).join('')}</section>` : '';
      const gate = data.gate ? `<section class="detail-section"><h3>${escapeHtml(data.gate.name)}</h3><p>${escapeHtml(data.gate.description)}</p></section>` : '';
      return `<section class="detail-section"><p>${escapeHtml(data.objective)}</p></section>${goals}${streams}${deliverables}${gate}`;
    }
    const scope = data.scope?.required ? `<section class="detail-section"><h3>Cần thực hiện</h3><p>${escapeHtml(data.scope.required)}</p></section>` : '';
    const excluded = data.scope?.excluded ? `<section class="detail-section"><h3>Không thực hiện</h3><p>${escapeHtml(data.scope.excluded)}</p></section>` : '';
    const dependencies = [...(data.dependencies?.documents || []), ...(data.dependencies?.coordination || []), ...(data.dependencies?.risks || [])].filter(Boolean);
    const dependencyHtml = dependencies.length ? `<section class="detail-section"><h3>Đầu vào, phụ thuộc và rủi ro</h3><ul>${dependencies.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : '';
    const deliverables = data.deliverables?.length ? `<section class="detail-section"><h3>Sản phẩm</h3><ul>${data.deliverables.map((item) => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.type)} · ${escapeHtml(item.location)}</li>`).join('')}</ul></section>` : '';
    const dod = data.definitionOfDone?.length ? `<section class="detail-section"><h3>Definition of Done</h3>${data.definitionOfDone.map((item) => `<div class="dod-item"><span class="dod-mark ${item.completed ? 'done' : ''}">${item.completed ? '✓' : '○'}</span><p>${escapeHtml(item.text)}</p></div>`).join('')}</section>` : '';
    return `${scope}${excluded}${dependencyHtml}${deliverables}${dod}`;
  }

  function detailLinks(data) {
    if (data.type === 'week') {
      const source = data.sources?.weeklyOverview || data.sources?.canonicalPlan;
      return source ? `<a href="../../../../${escapeHtml(source)}">Mở nguồn tuần</a>` : '';
    }
    if (data.type !== 'task') return '';
    const source = `<a href="../../../../${escapeHtml(data.source)}">Mở card task</a>`;
    const input = data.links?.input ? `<a href="../../../../${escapeHtml(data.links.input)}">Input</a>` : '';
    const output = data.links?.output ? `<a href="../../../../${escapeHtml(data.links.output)}">Output</a>` : '';
    const pr = data.links?.pullRequest ? `<a href="${escapeHtml(data.links.pullRequest)}" target="_blank" rel="noreferrer">Pull request</a>` : '';
    return `${source}${input}${output}${pr}`;
  }

  function renderDetail(node, pinned) {
    const data = node._timelineData;
    const typeLabel = data.type === 'week' ? `Tuần ${String(data.number).padStart(2, '0')}` : data.type === 'task' ? data.id : 'Hành trình';
    const meta = [];
    if (data.status) meta.push(data.status);
    if (data.owner) meta.push(`Phụ trách: ${data.owner}`);
    if (data.priority) meta.push(`Ưu tiên: ${data.priority}`);
    if (data.dueDateDisplay) meta.push(`Hạn: ${data.dueDateDisplay}`);
    if (data.type === 'week') meta.push(`${fmtDate(data.startDate)} — ${fmtDate(data.endDate)}`, `${data.tasks.length} task`);
    detailCard.innerHTML = `
      <div class="detail-topline"><p class="detail-kicker">${escapeHtml(typeLabel)}</p><button type="button" class="detail-close" aria-label="Đóng">Đóng</button></div>
      <h2>${escapeHtml(data.title)}</h2>
      <div class="detail-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      ${detailSections(data)}
      <div class="detail-links">${detailLinks(data)}</div>`;
    detailCard.hidden = false;
    detailCard.classList.toggle('is-pinned', pinned);
    requestAnimationFrame(() => detailCard.classList.add('is-visible'));
    positionDetail(node);
    detailCard.querySelector('.detail-close')?.addEventListener('click', unpinDetail);
  }

  function positionDetail(node) {
    if (window.innerWidth <= 780) return;
    const rect = node.getBoundingClientRect();
    const cardRect = detailCard.getBoundingClientRect();
    let left = rect.right + 18;
    if (left + cardRect.width > window.innerWidth - 14) left = rect.left - cardRect.width - 18;
    let top = rect.top + rect.height / 2 - cardRect.height / 2;
    top = Math.max(14, Math.min(top, window.innerHeight - cardRect.height - 14));
    detailCard.style.left = `${left}px`;
    detailCard.style.top = `${top}px`;
  }

  function setActive(node, active) {
    const id = node.dataset.nodeId;
    connectorElements.get(id)?.classList.toggle('is-active', active);
  }

  function unpinDetail() {
    if (pinnedNode) pinnedNode.classList.remove('is-pinned');
    pinnedNode = null;
    detailCard.classList.remove('is-pinned', 'is-visible');
    setTimeout(() => { if (!hoveredNode && !pinnedNode) detailCard.hidden = true; }, 180);
  }

  nodeLayer.addEventListener('pointerover', (event) => {
    const node = event.target.closest('.timeline-node');
    if (!node || pinnedNode) return;
    hoveredNode = node;
    setActive(node, true);
    renderDetail(node, false);
  });
  nodeLayer.addEventListener('pointerout', (event) => {
    const node = event.target.closest('.timeline-node');
    if (!node || pinnedNode || node.contains(event.relatedTarget)) return;
    hoveredNode = null;
    setActive(node, false);
    detailCard.classList.remove('is-visible');
    setTimeout(() => { if (!hoveredNode && !pinnedNode) detailCard.hidden = true; }, 180);
  });
  nodeLayer.addEventListener('focusin', (event) => {
    const node = event.target.closest('.timeline-node');
    if (!node || pinnedNode) return;
    hoveredNode = node;
    setActive(node, true);
    renderDetail(node, false);
  });
  nodeLayer.addEventListener('focusout', (event) => {
    const node = event.target.closest('.timeline-node');
    if (!node || pinnedNode) return;
    hoveredNode = null;
    setActive(node, false);
  });
  nodeLayer.addEventListener('click', (event) => {
    const node = event.target.closest('.timeline-node');
    if (!node) return;
    event.stopPropagation();
    if (pinnedNode && pinnedNode !== node) pinnedNode.classList.remove('is-pinned');
    pinnedNode = node;
    node.classList.add('is-pinned');
    renderDetail(node, true);
  });
  document.addEventListener('click', (event) => {
    if (pinnedNode && !detailCard.contains(event.target) && !event.target.closest('.timeline-node')) unpinDetail();
  });

  function updateMinimap() {
    const maxScroll = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
    const ratio = viewport.clientWidth / viewport.scrollWidth;
    const leftRatio = viewport.scrollLeft / viewport.scrollWidth;
    minimapWindow.style.width = `${Math.max(4, ratio * 100)}%`;
    minimapWindow.style.left = `${leftRatio * 100}%`;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    const week = Math.max(1, Math.min(24, Math.round((center - config.sidePadding - config.weekWidth) / config.weekWidth) + 1));
    positionLabel.textContent = center < weekX(1) - config.weekWidth / 2 ? 'Bắt đầu' : center > weekX(24) + config.weekWidth / 2 ? 'Kết thúc' : `Tuần ${String(week).padStart(2, '0')}`;
  }

  viewport.addEventListener('scroll', updateMinimap, { passive: true });
  minimap.addEventListener('click', (event) => {
    const rect = minimap.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    viewport.scrollTo({ left: ratio * viewport.scrollWidth - viewport.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  viewport.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      viewport.scrollLeft += event.deltaY;
    }
  }, { passive: false });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.timeline-node')) return;
    if (momentumFrame) cancelAnimationFrame(momentumFrame);
    dragState = { pointerId: event.pointerId, x: event.clientX, scrollLeft: viewport.scrollLeft, lastX: event.clientX, lastTime: performance.now(), velocity: 0 };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(1, now - dragState.lastTime);
    const dx = event.clientX - dragState.x;
    viewport.scrollLeft = dragState.scrollLeft - dx;
    dragState.velocity = (dragState.lastX - event.clientX) / dt * 16;
    dragState.lastX = event.clientX;
    dragState.lastTime = now;
  });
  function endDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const velocity = dragState.velocity;
    dragState = null;
    viewport.classList.remove('is-dragging');
    if (reduceMotion || Math.abs(velocity) < .25) return;
    let currentVelocity = velocity;
    const step = () => {
      viewport.scrollLeft += currentVelocity;
      currentVelocity *= .94;
      if (Math.abs(currentVelocity) > .22) momentumFrame = requestAnimationFrame(step);
    };
    momentumFrame = requestAnimationFrame(step);
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      viewport.scrollBy({ left: event.key === 'ArrowRight' ? config.weekWidth : -config.weekWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (event.key === 'Home') viewport.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (event.key === 'End') viewport.scrollTo({ left: viewport.scrollWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  function scrollToWeek(number) {
    viewport.scrollTo({ left: weekX(number) - viewport.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  document.getElementById('fit-button').addEventListener('click', () => viewport.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  document.getElementById('today-button').addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const week = project.weeks.find((item) => today >= item.startDate && today <= item.endDate) || project.weeks[0];
    scrollToWeek(week.number);
  });

  const canvasWidth = config.sidePadding * 2 + config.weekWidth * 26;
  canvas.style.width = `${canvasWidth}px`;
  connectorLayer.setAttribute('viewBox', `0 0 ${canvasWidth} ${Math.max(610, viewport.clientHeight)}`);
  renderPhases();
  renderEndpoint('start', config.sidePadding);
  project.weeks.forEach(renderWeek);
  renderEndpoint('finish', weekX(24) + config.weekWidth);
  updateMinimap();

  requestAnimationFrame(() => {
    const today = new Date().toISOString().slice(0, 10);
    const current = project.weeks.find((week) => today >= week.startDate && today <= week.endDate);
    if (current) scrollToWeek(current.number);
  });

  window.addEventListener('resize', () => {
    updateMinimap();
    if (pinnedNode) positionDetail(pinnedNode);
  });
})();
