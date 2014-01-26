'use strict';

function loadPendingReservations(scope, api) {

	scope.pendingRetrieved = false;
	scope.pending = [];
	scope.loading = true;

	return api.getOnlinePendingReservations(function(data) {
		data.forEach(function(element) {
			scope.pending.push({
				experiment : element.experiment,
				reservationId : element.reservationId,
				begin : element.timeSlot.begin,
				end : element.timeSlot.end,
				telescopes : element.telescopes
			});
		});

		scope.npages = Math.ceil(scope.pending.length / 10);
		scope.pagesArray = new Array(scope.npages);
		scope.pendingRetrieved = true;
		scope.loading = false;
	}, function(data) {
		console.log('error', data, status);
		scope.loading = false;
		scope.pendingRetrieved = true;
		scope.loading = false;
	}, function() {
		scope.$emit('unauthorized');
	});
}

function buildUIPendingTable(scope, elementName, paginationName, filter) {
	YUI()
			.use(
					'aui-datatable',
					'aui-pagination',
					function(Y) {

						scope.table = new Y.DataTable({
							columns : [ {
								key : 'reservationId',
								sortable : true,
								label : '#'
							}, {
								key : 'experiment',
								label : filter('i18n')('pending.table.experiment')
							}, {
								key : 'begin',
								label : filter('i18n')('pending.table.begin'),
								sortable : 'true',
								formatter : function(o) {
									return new Date(o.value).toUTCString();
								}

							}, {
								key : 'end',
								label : filter('i18n')('pending.table.end'),
								sortable : 'true',
								formatter : function(o) {
									o.rowClass = 'rowBack';
									o.value = new Date(o.value).toUTCString();
								}

							}, {
								key : 'telescopes',
								label : filter('i18n')('pending.table.telescopes')
							} ],
							recordset : scope.pending.slice(0, 10)
						});

						scope.pagination = new Y.Pagination(
								{
									contentBox : '#pagination2 .aui-pagination-content',
									page : 1,
									total : scope.npages,
									on : {
										changeRequest : function(event) {

											if (event.state.page <= scope.npages) {

												var fromIndex = ((event.state.page - 1) * 10);
												var toIndex = ((event.state.page - 1) * 10) + 10;

												scope.table.set('recordset',
														scope.pending.slice(
																fromIndex,
																toIndex));
											}
										}
									}
								});

						scope.table
								.delegate(
										'click',
										function(e) {
											var target = e.currentTarget;
											try {
												var record = this.getRecord(
														target).toJSON();

												if (record != null) {
													scope.selected = record;
													scope.selected.index = target._node.rowIndex;
													scope.selected.width = target._node.clientWidth;
													scope.selected.height = target._node.clientHeight;
													scope.selected.left = (e._currentTarget.clientWidth - scope.selected.width) / 2;
													scope.$apply();
												}
											} catch (error) {
											}

										}, 'tr', scope.table);

						scope.table.render('#table2');
						scope.pagination.render('#pagination2');
						scope.tableInit = true;

					});
}

function PendingReservationsListCtrl($gloriaAPI, $scope, $timeout, $location,
		$window, $gloriaLocale, $filter) {

	$scope.pendingReady = false;
	
	$gloriaLocale.loadResource('pending/lang', 'pending', function() {
		$scope.pendingReady = true;
	});
	
	$scope.pending = [];
	$scope.loading = true;
	$scope.pendingRetrieved = false;
	$scope.tableInit = false;
	$scope.selected = null;
	$scope.tableStyle = {};
	$scope.tableBuilt = false;
	$scope.goButton = {
		style : {}
	};
	$scope.cancelButton = {
		style : {}
	};

	$scope.$watch('pagesArray', function() {
		if (!$scope.tableBuilt && $scope.pending.length > 0) {
			buildUIPendingTable($scope, 'table', 'pagination', $filter);
			$scope.tableBuilt = true;
		}
	});

	$scope.$watch('selected', function() {
		if ($scope.selected != null) {

			$scope.reservationSelected = true;
			$scope.goButton.show = false;
			$scope.cancelButton.show = false;

			$scope.refreshInfo();

			var top = ($scope.selected.height * $scope.selected.index) + 3;
			var cancelLeft = $scope.selected.left - 48;
			var goLeft = cancelLeft + $scope.selected.width + 56;

			$scope.goButton.style.top = top + 'px';
			$scope.goButton.style.left = goLeft + 'px';

			$scope.cancelButton.style.top = top + 'px';
			$scope.cancelButton.style.left = cancelLeft + 'px';
		}
	});

	$scope.refreshInfo = function() {
		$gloriaAPI.getReservationInformation($scope.selected.reservationId,
				function(info) {
					if (info.status == 'READY') {
						$scope.goButton.show = true;
						$scope.cancelButton.show = false;
					} else if (info.status == 'SCHEDULED') {
						var beginDate = new Date($scope.selected.begin);

						if (beginDate < new Date()) {
							$scope.timer = $timeout($scope.refreshInfo, 1000);
						}
						$scope.goButton.show = false;
						$scope.cancelButton.show = true;
					} else {
						$scope.goButton.show = false;
						$scope.cancelButton.show = false;
					}
				}, function(error) {
					$scope.goButton.show = false;
					$scope.cancelButton.show = true;
				});
	};

	$scope.$watch('tableInit', function() {
		if ($scope.tableInit) {
			if ($scope.table != undefined) {
				$scope.table.set('recordset', $scope.pending.slice(0, 10));
				$scope.pagination.set('total', $scope.npages);
				$scope.table.render('#table2');
				$scope.pagination.render('#pagination2');
				$scope.loading = false;
			}
		}
	});

	$scope.go = function() {

		var url = $window.location.origin + '/'
				+ $scope.selected.experiment.toLowerCase() + '/#/view?rid=' + $scope.selected.reservationId;
		$window.location.href = url;
	};

	$scope.updateAfterCancel = function() {
		$scope.table.set('recordset', $scope.pending.slice(0, 10));
		$scope.pagination.set('total', $scope.npages);
		$scope.goButton.show = false;
		$scope.cancelButton.show = false;
	};

	$scope.cancel = function() {
		$gloriaAPI.cancelReservation($scope.selected.reservationId, function() {

			loadPendingReservations($scope, $gloriaAPI).then(function() {
				$scope.updateAfterCancel();
			}, function() {
				$scope.updateAfterCancel();
			});

		}, function(error) {

		}, function() {
			scope.$emit('unauthorized');
		});
	};

	loadPendingReservations($scope, $gloriaAPI);

	$scope.$on('$destroy', function() {
		$scope.table = null;
		$scope.pagination = null;
		$timeout.cancel($scope.timer);
	});

}
