

$(document).ready(function() {
	const STORAGE_KEY = 'visited_kommuner';
	let selected_kommuner = new Set();
	const default_color = "#5c8bd6";
	const hover_color = "#002868";
	const selected_color = "#4CAF50";

	// Load saved kommuner from localStorage
	function loadSavedKommuner() {
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
			listContainer.append(`<li>${kommune}</li>`);
		});
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

	$(document).mousemove(function(e) {
	  $('#info-box').css('top', e.pageY - $('#info-box').height()-30);
	  $('#info-box').css('left', e.pageX - ($('#info-box').width())/2);
	}).mouseover();
});



