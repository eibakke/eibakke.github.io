

$(document).ready(function() {
	const STORAGE_KEY = 'visited_kommuner';
	let selected_kommuner = new Set();
	const default_color = "#5c8bd6";
	const hover_color = "#002868";
	const selected_color = "#4CAF50";
	const royal_color = "#f59e0b"; // Amber/gold for royal visits
	const royal_unvisited_color = "#9ca3af"; // Gray for unvisited by royals

	// The 9 kommuner the King and Queen have NOT yet visited
	const royal_unvisited = new Set([
		"Beiarn",
		"Nissedal",
		"Siljan",
		"Etne",
		"Samnanger",
		"Vaksdal",
		"Askvoll",
		"Rindal",
		"Høylandet"
	]);

	let showingRoyalProgress = false;
	
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
		// Restore appropriate color based on whether royal view is active
		if (showingRoyalProgress) {
			if (royal_unvisited.has(kommuneName)) {
				$(`#${kommuneName}`).css('fill', royal_unvisited_color);
			} else {
				$(`#${kommuneName}`).css('fill', royal_color);
			}
		} else {
			$(`#${kommuneName}`).css('fill', default_color);
		}
		saveKommuner();
	}

	// Royal progress functions
	function toggleRoyalProgress() {
		showingRoyalProgress = !showingRoyalProgress;

		if (showingRoyalProgress) {
			showRoyalProgress();
		} else {
			hideRoyalProgress();
		}
	}

	function showRoyalProgress() {
		const total = $("path").length;
		const royalVisited = total - royal_unvisited.size;

		// Update button appearance
		$('#royal-btn').text('👑 Skjul Kongebesøk').addClass('active');
		$('#royal-info').removeClass('hidden');
		$('#royal-count').text(royalVisited);
		$('#total-count').text(total);

		// Apply royal colors to all paths
		$("path").each(function() {
			const kommune = $(this).attr("id");

			// Don't override user's selected kommuner (they stay green)
			if (selected_kommuner.has(kommune)) {
				return; // Skip, keep user's selection visible
			}

			// Show royal progress
			if (royal_unvisited.has(kommune)) {
				// Not visited by royals - gray
				$(this).css('fill', royal_unvisited_color);
			} else {
				// Visited by royals - amber/gold
				$(this).css('fill', royal_color);
			}
		});
	}

	function hideRoyalProgress() {
		// Update button appearance
		$('#royal-btn').text('👑 Se Kongebesøk').removeClass('active');
		$('#royal-info').addClass('hidden');

		// Restore original colors
		$("path").each(function() {
			const kommune = $(this).attr("id");

			// Keep user's selections
			if (selected_kommuner.has(kommune)) {
				$(this).css('fill', selected_color);
			} else {
				// Reset to default
				$(this).css('fill', default_color);
			}
		});
	}

	// Initialize
	loadSavedKommuner();

	$("path").click(function(e){
		const kommune = $(this).attr("id");
		if (selected_kommuner.has(kommune)) {
			selected_kommuner.delete(kommune);
			// If royal view is active, restore appropriate color
			if (showingRoyalProgress) {
				if (royal_unvisited.has(kommune)) {
					$(this).css('fill', royal_unvisited_color);
				} else {
					$(this).css('fill', royal_color);
				}
			} else {
				$(this).css('fill', default_color);
			}
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
		// Restore appropriate color based on current view mode
		if (showingRoyalProgress) {
			if (royal_unvisited.has(kommune)) {
				$(this).css('fill', royal_unvisited_color);
			} else {
				$(this).css('fill', royal_color);
			}
		} else {
			$(this).css('fill', default_color);
		}
	  }
	});

	// Royal progress button handler
	$('#royal-btn').click(function() {
		toggleRoyalProgress();
	});

	// Clear all button handler
	$('#clear-btn').click(function() {
		if (confirm('Er du sikker på at du vil fjerne alle valgte kommuner?')) {
			selected_kommuner.clear();
			// Reset colors based on whether royal view is active
			if (showingRoyalProgress) {
				$("path").each(function() {
					const kommune = $(this).attr("id");
					if (royal_unvisited.has(kommune)) {
						$(this).css('fill', royal_unvisited_color);
					} else {
						$(this).css('fill', royal_color);
					}
				});
			} else {
				$("path").css('fill', default_color);
			}
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
	
	// Mobile menu toggle
	$('#mobile-menu-btn').click(function() {
		$('#sidebar').toggleClass('open');
		$('.sidebar-overlay').toggleClass('show');
	});
	
	// Close sidebar when clicking overlay or close button
	$('.sidebar-overlay, #close-sidebar-btn').click(function() {
		$('#sidebar').removeClass('open');
		$('.sidebar-overlay').removeClass('show');
	});
	
	// Touch support for map
	let touchStartDistance = 0;
	let touchStartScale = 1;
	
	// Handle pinch zoom on mobile
	$('#svg-container').on('touchstart', function(e) {
		if (e.originalEvent.touches.length === 2) {
			e.preventDefault();
			const touch1 = e.originalEvent.touches[0];
			const touch2 = e.originalEvent.touches[1];
			touchStartDistance = Math.hypot(
				touch2.clientX - touch1.clientX,
				touch2.clientY - touch1.clientY
			);
			touchStartScale = currentZoom;
		}
	});
	
	$('#svg-container').on('touchmove', function(e) {
		if (e.originalEvent.touches.length === 2) {
			e.preventDefault();
			const touch1 = e.originalEvent.touches[0];
			const touch2 = e.originalEvent.touches[1];
			const currentDistance = Math.hypot(
				touch2.clientX - touch1.clientX,
				touch2.clientY - touch1.clientY
			);
			
			if (touchStartDistance > 0) {
				const scale = currentDistance / touchStartDistance;
				const newZoom = Math.max(0.5, Math.min(5, touchStartScale * scale));
				const factor = newZoom / currentZoom;
				
				// Calculate center point between touches
				const centerX = (touch1.clientX + touch2.clientX) / 2;
				const centerY = (touch1.clientY + touch2.clientY) / 2;
				
				// Get position relative to SVG
				const svg = $('#no-map')[0];
				const rect = svg.getBoundingClientRect();
				const relX = (centerX - rect.left) / rect.width;
				const relY = (centerY - rect.top) / rect.height;
				
				zoom(factor, relX, relY);
			}
		}
	});
	
	// Improve touch responsiveness for paths
	let touchTimer;
	$('path').on('touchstart', function(e) {
		const element = this;
		touchTimer = setTimeout(function() {
			// Long press shows info
			const info = $(element).data('info');
			$('#info-box').html(info).css({
				display: 'block',
				top: e.originalEvent.touches[0].pageY - 50,
				left: e.originalEvent.touches[0].pageX - 50
			});
		}, 500);
	});
	
	$('path').on('touchend', function(e) {
		clearTimeout(touchTimer);
		$('#info-box').css('display', 'none');
		// Trigger click for selection
		$(this).trigger('click');
		e.preventDefault();
	});
	
	$('path').on('touchmove', function() {
		clearTimeout(touchTimer);
		$('#info-box').css('display', 'none');
	});

	$(document).mousemove(function(e) {
	  $('#info-box').css('top', e.pageY - $('#info-box').height()-30);
	  $('#info-box').css('left', e.pageX - ($('#info-box').width())/2);
	}).mouseover();
});



