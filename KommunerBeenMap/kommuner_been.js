

$(document).ready(function() {
	const STORAGE_KEY = 'visited_kommuner';
	let selected_kommuner = new Set();
	const default_color = "#5c8bd6";
	const hover_color = "#002868";
	const selected_color = "#4CAF50";
	
	// Zoom and pan variables
	let currentZoom = 1;
	let isPanning = false;
	let startPoint = {x: 0, y: 0};
	let viewBox = {x: 0, y: 0, width: 2104.7244, height: 2979.9211};

	// URL sharing functionality
	function getUrlParameter(name) {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get(name);
	}
	
	function generateShareUrl() {
		const baseUrl = window.location.origin + window.location.pathname;
		const kommunerArray = Array.from(selected_kommuner).sort();
		const encodedKommuner = encodeURIComponent(kommunerArray.join(','));
		return `${baseUrl}?kommuner=${encodedKommuner}`;
	}
	
	function loadFromUrl() {
		const urlKommuner = getUrlParameter('kommuner');
		if (urlKommuner) {
			try {
				const kommunerArray = decodeURIComponent(urlKommuner).split(',').filter(k => k.length > 0);
				selected_kommuner = new Set(kommunerArray);
				// Apply URL selections to map
				kommunerArray.forEach(kommune => {
					$(`#${kommune}`).css('fill', selected_color);
				});
				// DON'T save to localStorage automatically - let users save their own
				updateCounter();
				// Show a notice that this is a shared view
				showSharedViewNotice();
				return true;
			} catch (error) {
				console.warn('Failed to load kommuner from URL:', error);
			}
		}
		return false;
	}
	
	function showSharedViewNotice() {
		const notice = $('<div id="shared-notice">Du ser på en delt liste. Gjør endringer for å lagre din egen versjon.</div>');
		$('#counter').after(notice);
		setTimeout(() => {
			notice.fadeOut(500, () => notice.remove());
		}, 5000);
	}

	// Load saved kommuner from localStorage
	function loadSavedKommuner() {
		// First try to load from URL (takes priority)
		if (loadFromUrl()) {
			return;
		}
		
		// Fallback to localStorage
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const kommunerArray = JSON.parse(saved);
			selected_kommuner = new Set(kommunerArray);
			// Apply saved selections to map
			kommunerArray.forEach(kommune => {
				$(`#${kommune}`).css('fill', selected_color);
			});
		}
		updateCounter();
	}

	// Save kommuner to localStorage
	function saveKommuner() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected_kommuner)));
		updateCounter();
	}

	// Update counter display
	function updateCounter() {
		const total = $("path").length;
		const visited = selected_kommuner.size;
		$('#counter').text(`${visited} av ${total} kommuner besøkt`);
		
		// Update the list
		const listContainer = $('#visited-list');
		listContainer.empty();
		const sortedKommuner = Array.from(selected_kommuner).sort();
		sortedKommuner.forEach(kommune => {
			const listItem = $(`<li>
				<span class="kommune-name">${kommune}</span>
				<button class="remove-btn" data-kommune="${kommune}" title="Fjern">×</button>
			</li>`);
			listContainer.append(listItem);
		});
	}
	
	// Remove kommune function
	function removeKommune(kommuneName) {
		selected_kommuner.delete(kommuneName);
		$(`#${kommuneName}`).css('fill', default_color);
		saveKommuner();
	}

	// Initialize
	loadSavedKommuner();

	$("path").click(function(e){
		const kommune = $(this).attr("id");
		if (selected_kommuner.has(kommune)) {
			selected_kommuner.delete(kommune);
			$(this).css('fill', default_color);
		} else {
			$(this).css('fill', selected_color);
			selected_kommuner.add(kommune);
		}
		saveKommuner();
	});

	$("path").hover(function(e) {
	  $('#info-box').css('display', 'block');
	  $('#info-box').html($(this).data('info'));
	  const kommune = $(this).attr("id");
	  if (!selected_kommuner.has(kommune)){
	  	$(this).css('fill', hover_color);
	  }
	});

	$("path").mouseleave(function(e) {
	  const kommune = $(this).attr("id");
	  $('#info-box').css('display','none');
	  if (!selected_kommuner.has(kommune)){
	  	$(this).css('fill', default_color);	  	
	  }
	});

	// Clear all button handler
	$('#clear-btn').click(function() {
		if (confirm('Er du sikker på at du vil fjerne alle valgte kommuner?')) {
			selected_kommuner.clear();
			$("path").css('fill', default_color);
			saveKommuner();
		}
	});
	
	// Remove button handler (using event delegation)
	$(document).on('click', '.remove-btn', function(e) {
		e.stopPropagation();
		const kommuneName = $(this).data('kommune');
		removeKommune(kommuneName);
	});
	
	// Share button handler
	$('#share-btn').click(function() {
		if (selected_kommuner.size === 0) {
			alert('Du må velge minst én kommune før du kan dele!');
			return;
		}
		
		const shareUrl = generateShareUrl();
		
		// Try to use modern clipboard API
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(shareUrl).then(() => {
				showShareSuccess();
			}).catch(() => {
				fallbackCopyToClipboard(shareUrl);
			});
		} else {
			fallbackCopyToClipboard(shareUrl);
		}
	});
	
	// Fallback copy method for older browsers
	function fallbackCopyToClipboard(text) {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-999999px';
		textArea.style.top = '-999999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		
		try {
			document.execCommand('copy');
			showShareSuccess();
		} catch (err) {
			prompt('Kopier denne lenken:', text);
		} finally {
			textArea.remove();
		}
	}
	
	// Show success message
	function showShareSuccess() {
		const btn = $('#share-btn');
		const originalText = btn.text();
		btn.text('Lenke kopiert!').addClass('copied');
		
		setTimeout(() => {
			btn.text(originalText).removeClass('copied');
		}, 2000);
	}
	
	// Zoom functionality
	function updateViewBox() {
		const svg = $('#no-map')[0];
		svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
	}
	
	function zoom(factor, centerX, centerY) {
		// Calculate new dimensions
		const newWidth = viewBox.width / factor;
		const newHeight = viewBox.height / factor;
		
		// Calculate new position to keep zoom centered
		const newX = viewBox.x + (viewBox.width - newWidth) * (centerX || 0.5);
		const newY = viewBox.y + (viewBox.height - newHeight) * (centerY || 0.5);
		
		// Update viewBox
		viewBox = {
			x: Math.max(0, Math.min(newX, 2104.7244 - newWidth)),
			y: Math.max(0, Math.min(newY, 2979.9211 - newHeight)),
			width: newWidth,
			height: newHeight
		};
		
		currentZoom *= factor;
		updateViewBox();
		updateZoomDisplay();
	}
	
	function updateZoomDisplay() {
		$('#zoom-level').text(`${Math.round(currentZoom * 100)}%`);
	}
	
	// Mouse wheel zoom
	$('#svg-container').on('wheel', function(e) {
		e.preventDefault();
		const delta = e.originalEvent.deltaY;
		const factor = delta > 0 ? 0.9 : 1.1;
		
		// Get mouse position relative to SVG
		const svg = $('#no-map')[0];
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
		
		// Calculate relative position
		const relX = (svgP.x - viewBox.x) / viewBox.width;
		const relY = (svgP.y - viewBox.y) / viewBox.height;
		
		zoom(factor, relX, relY);
	});
	
	// Pan functionality
	$('#no-map').on('mousedown', function(e) {
		if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Middle button or shift+left click
			isPanning = true;
			startPoint = {x: e.clientX, y: e.clientY};
			e.preventDefault();
			$('#svg-container').css('cursor', 'grabbing');
		}
	});
	
	$(document).on('mousemove', function(e) {
		if (!isPanning) return;
		
		const dx = (e.clientX - startPoint.x) * (viewBox.width / $('#svg-container').width());
		const dy = (e.clientY - startPoint.y) * (viewBox.height / $('#svg-container').height());
		
		viewBox.x = Math.max(0, Math.min(viewBox.x - dx, 2104.7244 - viewBox.width));
		viewBox.y = Math.max(0, Math.min(viewBox.y - dy, 2979.9211 - viewBox.height));
		
		updateViewBox();
		startPoint = {x: e.clientX, y: e.clientY};
	});
	
	$(document).on('mouseup', function() {
		isPanning = false;
		$('#svg-container').css('cursor', 'default');
	});
	
	// Zoom controls
	$('#zoom-in').click(function() {
		zoom(1.2);
	});
	
	$('#zoom-out').click(function() {
		zoom(0.8);
	});
	
	$('#reset-view').click(function() {
		viewBox = {x: 0, y: 0, width: 2104.7244, height: 2979.9211};
		currentZoom = 1;
		updateViewBox();
		updateZoomDisplay();
	});
	
	// Initialize zoom display
	updateZoomDisplay();

	$(document).mousemove(function(e) {
	  $('#info-box').css('top', e.pageY - $('#info-box').height()-30);
	  $('#info-box').css('left', e.pageX - ($('#info-box').width())/2);
	}).mouseover();
});



