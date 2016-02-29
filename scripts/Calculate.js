//Performs the cost and force calculation of the truss
var E=require('./EntityController');
var Grid=require('./Grid');

function calculateDesignWeight(){
	var weight=0; //in g
	var weightPerNode=Math.PI*Math.pow(E.node_diameter/2,2)*E.crane_depth*E.node_density;
	var weightPerMemberLength=E.member_width*E.member_thickness*E.member_density; //g per cm
	var missingWeightPerMember=2*Math.PI*Math.pow(E.node_diameter/2,2)*E.member_thickness; //this is the negative weight of the 2 holes in each member

	for(var i=0;i<E.nodes.length;i++){
		weight+=weightPerNode;
	}
	for(var j=0;j<E.members.length;j++){
		var length=E.members[j].calcLength()/Grid.px_per_cm; //length of member in cm
		weight+=weightPerMemberLength*length-missingWeightPerMember;
	}
	return weight;
}
//Calculating the support reactions at the 2 support nodes using moments
function calculateSupportReactions(){
	//calculate support reactions, and otherwise 0 if the car is completely out of the bridge and not touching the supports
	E.supportA.setForce(-1*Math.abs(E.crane_length/E.crane_height*E.loadedPin.external_force[1]),Math.abs(E.loadedPin.external_force[1]),Grid.canvas);
	E.supportB.setForce(-1*E.supportA.external_force[0],0,Grid.canvas);
	console.log('Support A');
	console.log(E.supportA.external_force);
	console.log(E.supportB.external_force);
}

//Creates a matrix of 2N-3 equations based on the method of joints, and solves it
function methodOfJoints(){
	var force_matrix=[]; //each row will represent an Fx and Fy equation for each node
	var solution=[]; //this will represent the external forces in the x and y direction acting on the node

	for(var i=0;i<E.nodes.length;i++){ //iterate through all of the nodes that exist
		var rowX=[]; //will represent the Fx equation for the node
		var rowY=[]; //will represent the Fy equation for the node
		solution.push(-E.nodes[i].external_force[0]); //the external forces in the x direction of the node
		solution.push(-E.nodes[i].external_force[1]); //the external forces in the y direction o fthe noe
		
		for(var j=0;j<E.members.length;j++){ //iterate through all of the members that exist
			E.members[j].calcLength();
			E.members[j].calcUnitVector();

			var connected=false; //check if the member is connected to the node
			for(var k=0;k<E.nodes[i].connected_members.length;k++){ 
				if(E.members[j]===E.nodes[i].connected_members[k]){ //if the member is connected to the node
					if(E.nodes[i].connected_members[k].x1===E.nodes[i].left && E.nodes[i].connected_members[k].y1===E.nodes[i].top){ //if the start of the member is connected to the node
						rowX.push(E.nodes[i].connected_members[k].unit_vector[0]);
						rowY.push(E.nodes[i].connected_members[k].unit_vector[1]);
						
					}
					else{ //if the end of the member is at the node, flip the direction so all forces are tensile
						rowX.push(-1*E.nodes[i].connected_members[k].unit_vector[0]);
						rowY.push(-1*E.nodes[i].connected_members[k].unit_vector[1]);
						
					}
					connected=true;
				}

			}
			if(!connected){ //if the member is not connected to the node, then its not part of its Force equations
				rowX.push(0);
				rowY.push(0);
			}
		}
		force_matrix.push(rowX);
		force_matrix.push(rowY);
	}

	//eliminating last 3 equation since we have 2N equations and have 2N-3 members, thus we have 3 extra equations 
	force_matrix.pop();
	force_matrix.pop();
	force_matrix.pop();
	solution.pop();
	solution.pop();
	solution.pop();
	console.log(numeric.prettyPrint(force_matrix));
	console.log(numeric.prettyPrint(solution));
	var forces=numeric.solve(force_matrix, solution, false); //solving for the forces

	E.designPass=true; //for checking whether a design meets the criteria
	
	//applying the force value to the specified member, as well as checking if its under the constraints
	for(i=0;i<E.members.length;i++){
		E.members[i].setForce(forces[i],E);
		// if(forces[i]>0 && forces[i]>E.max_tensile){
		// 	E.designPass=false;
		// }
		// else if(forces[i]<0 && Math.abs(forces[i])>E.max_compressive){
		// 	E.designPass=false;
		// }
	}
}

function calculateRuptureAndBucklingStress(){
	var minimumArea=(E.member_width*E.member_thickness-E.node_diameter*E.member_thickness)*100;//to convert cm^2 to mm2
	var maximumArea=E.member_width*E.member_thickness*100;
	var momentOfAreaMember=E.member_width*Math.pow(E.member_thickness,3)*10000/12; //we multiply by 10000 to convert cm4 to mm4
	var pi_squared=Math.PI*Math.PI;
	var maximumBearingLoad=E.maximum_bearing_stress*E.member_thickness*E.node_diameter*100; //multiply by 100 to convert cm2 to mm2
	console.log('THe maximum bearing load is'+maximumBearingLoad);
	for(i=0;i<E.members.length;i++){
		if(E.members[i].force===0){
			E.members[i].stress=0;
		}
		else if(E.members[i].force>0){ //if we have a tensile force (make sure theres no rupture)
			E.members[i].stress=E.members[i].force/minimumArea;
			if(E.members[i].stress>E.max_tensile_stress){
				E.members[i].rupture_failure=true;
				console.log('member '+i+' ruptured');
			}
		}
		else if(E.members[i].force<0){ //under compressive stress, make sure there no buckling
			E.members[i].stress=E.members[i].force/maximumArea;
			E.members[i].critical_load=pi_squared*E.member_modulus_elasticity*momentOfAreaMember/Math.pow((E.members[i].member_length*10/Grid.px_per_cm),2);

			if(Math.abs(E.members[i].force)>E.members[i].critical_load/4){//we devide the critical load by 4 since euler's appriximation overestimates
				E.members[i].buckling_failure=true;
				console.log('member '+i+' buckled');
			}
			if(Math.abs(E.members[i].stress)>E.max_tensile_stress){
				E.members[i].compressive_failure=true;
				console.log('member '+i+' failed due to compression');
			}
		}
	}
}

function calculateMaxShearForce(){
	var node_area=Math.PI*Math.pow(E.node_diameter,2)*100/4;//multiply by 100 to convert to mm2
	for(var i=0;i<E.nodes.length;i++){
		var forces=[];
		var force_arrangement=[];
		var shear_forces=[];
		var maximum_shear_force=0;
		forces.push(E.nodes[i].external_force);
		debugger
		//add the forces of the members to the force array
		for(var j=0;j<E.nodes[i].connected_members.length;j++){
			E.nodes[i].connected_members[j].calcUnitVector();
			forces.push([E.nodes[i].connected_members[j].force*E.nodes[i].connected_members[j].unit_vector[0],E.nodes[i].connected_members[j].force*E.nodes[i].connected_members[j].unit_vector[1]]);
		}
		console.log(forces);

		var firstLowest=1E12, secondLowest=1E12, firstLowestIndex=null, secondLowestIndex=null;
		//find the two lowest magnitude forces
		for(var j=0;j<forces.length;j++){
			var magnitude=Math.sqrt(forces[j][0]*forces[j][0]+forces[j][1]*forces[j][1]);
			if(magnitude<firstLowest){
				firstLowest=magnitude;
				firstLowestIndex=i;
			}
			else if (magnitude<secondLowest){
				secondLowest=magnitude;
				secondLowestIndex=j;
			}
		}

		shear_forces.push(firstLowest);
		shear_forces.push(secondLowest);
		force_arrangement.push(forces.splice(firstLowestIndex,1));
		firstLowestIndex < secondLowestIndex ? forces.splice(secondLowestIndex-1,1) : forces.splice(secondLowestIndex,1); //get rid of of the second greatest force

		var total_x=force_arrangement[0][0];
		var total_y=force_arrangement[0][1];
		while(forces.length>1){
			var lowest_mag=1E12;
			var lowest_index=null;
			for(var j=0;j<forces.length;j++){
				var shear=Math.sqrt(Math.pow(total_x+forces[j][0],2)+Math.pow(total_y+forces[j][1],2));
				if(shear<lowest_mag){
					lowest_mag=shear;
					lowest_index=j;
				}
			}
			total_x+=forces[lowest_index][0];
			total_y+=forces[lowest_index][1];
			shear_forces.push(Math.sqrt(Math.pow(total_x,2)+Math.pow(total_y,2)));
			force_arrangement.push(forces.splice(lowest_index,1));
		}

		for(var j=0;j<shear_forces.length;j++){
			if(shear_forces[j]>maximum_shear_force){
				maximum_shear_force=shear_forces[j];
			}
		}
		E.nodes[i].maximum_shear_stress=maximum_shear_force/node_area;
	}
}

module.exports=function (){
	Grid.calcPxPerCm(E);
	E.design_weight=calculateDesignWeight();

	E.loadedPin.setForce(0,-1*E.design_weight*9.8*E.desired_ratio/1000/2,Grid.canvas);//we devide by 2 because we're calculating for half the truss
	calculateSupportReactions();
	methodOfJoints();
	// E.calculateBearingMaxBearingStress();
	// calculateRuptureAndBucklingStress();
	// calculateMaxShearForce();
	// calculateSupportReactions();
	// calculateWeightDistributionOfCar();
	// methodOfJoints();
	// $('#bridge_cost').text(calculateCost());
};
