'use strict';

function pad(n) {
	return (n < 10) ? ("0" + n) : n;
}

toolbox.lazy.filter('UTCFullFilter', function() {
	return function(input) {
		return new Date(input).toUTCString();
	};
});

toolbox.lazy.filter('UTCTimeFilter', function() {
	return function(input) {
		var date = new Date(input);
		var dateStr = '' + pad(date.getUTCHours());
		dateStr += ':' + pad(date.getUTCMinutes());
		dateStr += ' UT';
		return dateStr;
	};
});

toolbox.lazy.filter('TimeFilter', function() {
	return function(input) {
		var date = new Date(input);
		var dateStr = '' + pad(date.getHours());
		dateStr += ':' + pad(date.getMinutes());
		return dateStr;
	};
});

toolbox.lazy.filter('DateFilter', function() {
	return function(input) {
		var date = new Date(input);
		var dateStr = '' + pad(date.getMonth() + 1);
		dateStr += '/' + pad(date.getDate());
		dateStr += '/' + pad(date.getFullYear());
		return dateStr;
	};
});

toolbox.lazy.filter('UTCDateFilter', function() {
	return function(input) {
		var date = new Date(input);
		var dateStr = '' + pad(date.getUTCMonth() + 1);
		dateStr += '/' + pad(date.getUTCDate());
		dateStr += '/' + pad(date.getUTCFullYear());
		dateStr += ' UT';
		return dateStr;
	};
});

function loadAvailableReservations(scope, api) {

	scope.available = [];
	scope.loading = true;

	api.getAvailableReservations(scope.experimentSelected,
			[ scope.telescopeSelected ], scope.date, function(data) {
				var slots = [];
				data.forEach(function(element) {
					slots.push({
						begin : element.begin,
						end : element.end,
					});
				});

				scope.available = slots;
				scope.npages = Math.ceil(slots.length / scope.slotsPerPage);

				if (scope.table != undefined) {
					scope.table.set('recordset', scope.available.slice(0,
							scope.slotsPerPage));
					scope.pagination.set('total', scope.npages);
				}

				scope.loading = false;

			}, function(data, status) {
				console.log('error', data, status);
				scope.loading = false;
			}, function() {
				scope.$emit('unauthorized');
			});
}

function buildUIAvTable(scope, elementName, paginationName, filter) {
	YUI()
			.use(
					'aui-datatable',
					'aui-pagination',
					function(Y) {

						scope.table = new Y.DataTable({
							// boundingBox : '#table',
							columns : [ {
								key : 'begin',
								label : filter('i18n')('new.phases.four.table.begin'),
								sortable : 'true',
								formatter : function(o) {
									o.rowClass = 'rowBack';

									var date = new Date(o.value);

									var dateStr = '' + pad(date.getHours());
									dateStr += ':' + pad(date.getMinutes());

									dateStr += ' (' + pad(date.getUTCHours());
									dateStr += ':' + pad(date.getUTCMinutes());
									dateStr += ' UT)';

									o.value = dateStr;
								}

							}, {
								key : 'end',
								label : filter('i18n')('new.phases.four.table.end'),
								sortable : 'true',
								formatter : function(o) {
									o.rowClass = 'rowBack';
									var date = new Date(o.value);

									var dateStr = '' + pad(date.getHours());
									dateStr += ':' + pad(date.getMinutes());

									dateStr += ' (' + pad(date.getUTCHours());
									dateStr += ':' + pad(date.getUTCMinutes());
									dateStr += ' UT)';

									o.value = dateStr;
								}

							} ],
							recordset : scope.available.slice(0,
									scope.slotsPerPage)
						});

						scope.table.delegate('click', function(e) {
							var target = e.currentTarget;
							var record = this.getRecord(target).toJSON();

							if (record != null) {
								if (record.begin != null
										&& record.begin != undefined) {
									scope.slotSelected = true;
									scope.slot = record;
									scope.reservationDone = false;
									scope.reservationError = false;
									scope.$apply();
								}
							}

						}, 'tr', scope.table);

						scope.table.render('#table');

						scope.pagination = new Y.Pagination(
								{
									contentBox : '#pagination aui-pagination-content',
									page : 1,
									total : scope.npages,
									on : {
										changeRequest : function(event) {

											if (event.state.page <= scope.npages) {

												var fromIndex = ((event.state.page - 1) * scope.slotsPerPage);
												var toIndex = ((event.state.page - 1) * scope.slotsPerPage)
														+ scope.slotsPerPage;

												scope.table.set('recordset',
														scope.available.slice(
																fromIndex,
																toIndex));
											}
										}
									}
								});

						scope.pagination.render('#pagination');
					});
}

function AvailableReservationsListCtrl($gloriaAPI, $scope, $timeout, $location,
		$gloriaLocale, $filter) {

	$scope.ready = false;
	
	$gloriaLocale.loadResource('new/lang', 'new', function() {
		$scope.ready = true;
	});
	
	$scope.summaryStyle = {};

	// $('#select-exp').tooltip('show');

	$scope.available = [];
	$scope.slotsPerPage = 10;
	$scope.slotSelected = false;
	$scope.dateSelected = false;
	$scope.reservationDone = false;
	$scope.reservationError = false;

	$scope.date = null;

	buildUIAvTable($scope, 'table', 'pagination', $filter);

	$scope.$watch('date', function() {
		if ($scope.date != null && $scope.telescopeSelected) {
			$scope.slotSelected = false;
			$scope.dateSelected = true;
			$scope.reservationDone = false;
			$scope.reservationError = false;
			loadAvailableReservations($scope, $gloriaAPI);
		}
	});

	$scope.reserve = function() {
		$scope.reservationDone = false;
		$gloriaAPI.makeReservation($scope.experimentSelected,
				[ $scope.telescopeSelected ], $scope.slot.begin,
				$scope.slot.end, function(data) {
					$scope.reservationDone = true;
					$scope.reservationError = false;
					$scope.timer = $timeout($scope.onTimeout, 2000);
				}, function(data) {
					console.log('error', data);
					$scope.reservationError = true;
					$scope.reservationDone = false;
					$scope.loading = false;
				});
	};

	$scope.back = function() {
		$scope.dateSelected = false;
		$scope.slotSelected = false;
	};

	$scope.onTimeout = function() {
		loadAvailableReservations($scope, $gloriaAPI);
	};

	$scope.experimentClicked = function(experiment) {
		$scope.experimentSelected = experiment;
		$scope.telescopeSelected = null;
		$scope.slotSelected = false;
		$scope.available = [];
		$scope.dateSelected = false;
		$scope.reservationDone = false;
		$scope.reservationError = false;
		if (experiment == 'SOLAR') {
			$scope.summaryStyle.backgroundImage = 'url(new/img/sun-summary.jpg)';
		} else {
			$scope.summaryStyle.backgroundImage = 'url(new/img/night-summary.jpg)';
		}
	};

	$scope.telescopeClicked = function(rt) {
		$scope.telescopeSelected = rt;
		$scope.slotSelected = false;
		$scope.dateSelected = false;
		$scope.reservationDone = false;
		$scope.reservationError = false;
	};

	$scope.$on('$destroy', function() {
		$timeout.cancel($scope.timer);
	});
}
