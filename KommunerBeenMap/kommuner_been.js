

$(document).ready(function() {
	// TODO(ebakke): add the clicked kommuner to a list, show it on the side

	selected_kommuner = new Set();
	default_color = "#5c8bd6";
	hover_color = "#002868";

	$("path").click(function(e){
		kommune = $(this).attr("id");
		if (selected_kommuner.has(kommune)) {
			selected_kommuner.delete(kommune);
			$(this).css('fill', default_color);
		} else {
			$(this).css('fill', 'green');
			selected_kommuner.add(kommune);
		}

		console.log(selected_kommuner);
	});

	$("path").hover(function(e) {
	  $('#info-box').css('display', 'block');
	  $('#info-box').html($(this).data('info'));
	  kommune = $(this).attr("id");
	  if (!selected_kommuner.has(kommune)){
	  	$(this).css('fill', hover_color);
	  }
	});

	$("path").mouseleave(function(e) {
	  kommune = $(this).attr("id");
	  $('#info-box').css('display','none');
	  if (!selected_kommuner.has(kommune)){
	  	$(this).css('fill', default_color);	  	
	  }
	});

	$(document).mousemove(function(e) {
	  $('#info-box').css('top', e.pageY - $('#info-box').height()-30);
	  $('#info-box').css('left', e.pageX - ($('#info-box').width())/2);
	}).mouseover();
});



