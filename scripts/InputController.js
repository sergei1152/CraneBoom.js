//Handles monitoring changes from the input text fields and applying them to the appropriate controller
//Also handles import and export events when the buttons are pressed

var EntityController=require('./EntityController');
var Grid=require('./Grid');
var Optimizer=require('./Optimizer');
var Calculate=require('./Calculate');

var InputController=function(){

	$('#optimizer_var_input').change(function() {
	    var variance = parseInt($(this).val());
	    if (!isNaN(variance) && variance!==0) { //to make sure the input is valid (is an integer and non-zero)
	      	Optimizer.variation=variance;
	    }
	});

	$('#desired_ratio_input').change(function() {
	    var ratio = parseInt($(this).val());
	    if (!isNaN(ratio) && ratio >1) { //to make sure the input is valid (is an integer and greater than 1)
	       EntityController.desired_ratio=ratio;
	       Calculate();
	    }
	});

	//Monitors for changes in the grid spacing input field and re-creates the grid if a change is detected
	$('#grid-size-input').change(function() {
	    var new_grid_size = parseInt($('#grid-size-input').val());
	    if (!isNaN(new_grid_size) && new_grid_size > Grid.min_grid_size) { //makes sure the new grid size is an integer and greater than the minimum grid size
	        Grid.grid_size = new_grid_size;
	        Grid.createGrid(); //recreates the grid with the new specified grid size
	    }
	});

	$('#exportBtn').click(function() {
		jsonStr = JSON.stringify(EntityController.export()); //export the entity controller as a string
		$('#export-cont').val(jsonStr); //paste the string in the export field
		$('#uniqueHash').val(EntityController.exportHash(jsonStr)); //hash the output and paste it in the hash input field
		return false;
	});

	$('#importBtn').click(function() {
		jsonStr = $('#export-cont').val(); //stores the value of the import text field
		if (jsonStr.length > 0) { //makes sure its not empty
			if (jsonStr.charAt(1) == 'A') { //if the input is a hash
				EntityController.importHash(jsonStr);
			} else { //if the input is not hashed
				jsonObj = JSON.parse(jsonStr);
				EntityController.import(jsonObj);
			}
		}
		return false;
	});

	//selects all of the text on click of the export and hash input fields
	$('#export-cont').click(function () {
		this.select();
	});
	$('#uniqueHash').click(function() {
		this.select();
	});
};

module.exports=InputController;