/* jshint loopfunc: true */
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('zeppelinWebApp').controller('NotebookCtrl', function($scope, $route, $routeParams, $location,
                                                                     $rootScope, $http, websocketMsgSrv, baseUrlSrv,
                                                                     $timeout, SaveAsService) {
  $scope.note = null;
  $scope.showEditor = false;
  $scope.editorToggled = false;
  $scope.tableToggled = false;
  $scope.viewOnly = false;
  $scope.showSetting = false;
  $scope.looknfeelOption = [ 'default', 'simple', 'report'];
  $scope.cronOption = [
    {name: 'None', value : undefined},
    {name: '1m', value: '0 0/1 * * * ?'},
    {name: '5m', value: '0 0/5 * * * ?'},
    {name: '1h', value: '0 0 0/1 * * ?'},
    {name: '3h', value: '0 0 0/3 * * ?'},
    {name: '6h', value: '0 0 0/6 * * ?'},
    {name: '12h', value: '0 0 0/12 * * ?'},
    {name: '1d', value: '0 0 0 * * ?'}
  ];

  $scope.interpreterSettings = [];
  $scope.interpreterBindings = [];
  $scope.isNoteDirty = null;
  $scope.saveTimer = null;

  var angularObjectRegistry = {};
  var connectedOnce = false;

  $scope.$on('setConnectedStatus', function(event, param) {
    if(connectedOnce && param){
      initNotebook();
    }
    connectedOnce = true;
  });

  $scope.getCronOptionNameFromValue = function(value) {
    if (!value) {
      return '';
    }

    for (var o in $scope.cronOption) {
      if ($scope.cronOption[o].value===value) {
        return $scope.cronOption[o].name;
      }
    }
    return value;
  };

  /** Init the new controller */
  var initNotebook = function() {
    websocketMsgSrv.getNotebook($routeParams.noteId);
  };

  initNotebook();

  /** Remove the note and go back tot he main page */
  /** TODO(anthony): In the nearly future, go back to the main page and telle to the dude that the note have been remove */
  $scope.removeNote = function(noteId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to delete this notebook?',
      callback: function(result) {
        if (result) {
          websocketMsgSrv.deleteNotebook(noteId);
          $location.path('/#');
        }
      }
    });
  };

  //Export notebook
  $scope.exportNotebook = function() {
    var jsonContent = JSON.stringify($scope.note);
    SaveAsService.SaveAs(jsonContent, $scope.note.name, 'json');
  };

  //Clone note
  $scope.cloneNote = function(noteId) {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to clone this notebook?',
      callback: function(result) {
        if (result) {
          websocketMsgSrv.cloneNotebook(noteId);
          $location.path('/#');
        }
      }
    });
  };

  $scope.runNote = function() {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Run all paragraphs?',
      callback: function(result) {
        if (result) {
          _.forEach($scope.note.paragraphs, function (n, key) {
            angular.element('#' + n.id + '_paragraphColumn_main').scope().runParagraph(n.text);
          });
        }
      }
    });
  };

  $scope.saveNote = function() {
    if ($scope.note && $scope.note.paragraphs) {
      _.forEach($scope.note.paragraphs, function(n, key) {
        angular.element('#' + n.id + '_paragraphColumn_main').scope().saveParagraph();
      });
      $scope.isNoteDirty = null;
    }
  };

  $scope.clearAllParagraphOutput = function() {
    BootstrapDialog.confirm({
      closable: true,
      title: '',
      message: 'Do you want to clear all output?',
      callback: function(result) {
        if (result) {
          _.forEach($scope.note.paragraphs, function(n, key) {
            angular.element('#' + n.id + '_paragraphColumn_main').scope().clearParagraphOutput();
          });
        }
      }
    });
  };

  $scope.toggleAllEditor = function() {
    if ($scope.editorToggled) {
      $scope.$broadcast('openEditor');
    } else {
      $scope.$broadcast('closeEditor');
    }
    $scope.editorToggled = !$scope.editorToggled;
  };

  $scope.showAllEditor = function() {
    $scope.$broadcast('openEditor');
  };

  $scope.hideAllEditor = function() {
    $scope.$broadcast('closeEditor');
  };

  $scope.toggleAllTable = function() {
    if ($scope.tableToggled) {
      $scope.$broadcast('openTable');
    } else {
      $scope.$broadcast('closeTable');
    }
    $scope.tableToggled = !$scope.tableToggled;
  };

  $scope.showAllTable = function() {
    $scope.$broadcast('openTable');
  };

  $scope.hideAllTable = function() {
    $scope.$broadcast('closeTable');
  };

  $scope.isNoteRunning = function() {
    var running = false;
    if(!$scope.note){ return false; }
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ( $scope.note.paragraphs[i].status === 'PENDING' || $scope.note.paragraphs[i].status === 'RUNNING') {
        running = true;
        break;
      }
    }
    return running;
  };

  $scope.killSaveTimer = function() {
    if ($scope.saveTimer) {
      $timeout.cancel($scope.saveTimer);
      $scope.saveTimer = null;
    }
  };

  $scope.startSaveTimer = function() {
    $scope.killSaveTimer();
    $scope.isNoteDirty = true;
    //console.log('startSaveTimer called ' + $scope.note.id);
    $scope.saveTimer = $timeout(function(){
      $scope.saveNote();
    }, 10000);
  };

  angular.element(window).on('beforeunload', function(e) {
    $scope.killSaveTimer();
    $scope.saveNote();
  });

  $scope.$on('$destroy', function() {
    angular.element(window).off('beforeunload');
    $scope.killSaveTimer();
    $scope.saveNote();
  });

  $scope.setLookAndFeel = function(looknfeel) {
    $scope.note.config.looknfeel = looknfeel;
    $scope.setConfig();
  };

  /** Set cron expression for this note **/
  $scope.setCronScheduler = function(cronExpr) {
    $scope.note.config.cron = cronExpr;
    $scope.setConfig();
  };

  /** Update note config **/
  $scope.setConfig = function(config) {
    if(config) {
      $scope.note.config = config;
    }
    websocketMsgSrv.updateNotebook($scope.note.id, $scope.note.name, $scope.note.config);
  };

  /** Update the note name */
  $scope.sendNewName = function() {
    if ($scope.note.name) {
      websocketMsgSrv.updateNotebook($scope.note.id, $scope.note.name, $scope.note.config);
    }
  };

  /** update the current note */
  $scope.$on('setNoteContent', function(event, note) {
    $scope.paragraphUrl = $routeParams.paragraphId;
    $scope.asIframe = $routeParams.asIframe;
    if ($scope.paragraphUrl) {
      note = cleanParagraphExcept($scope.paragraphUrl, note);
      $rootScope.$broadcast('setIframe', $scope.asIframe);
    }

    if ($scope.note === null) {
      $scope.note = note;
    } else {
      updateNote(note);
    }
    initializeLookAndFeel();
    //open interpreter binding setting when there're none selected
    getInterpreterBindings(getInterpreterBindingsCallBack);
  });


  var initializeLookAndFeel = function() {
    if (!$scope.note.config.looknfeel) {
      $scope.note.config.looknfeel = 'default';
    } else {
      $scope.viewOnly = $scope.note.config.looknfeel === 'report' ? true : false;
    }
    $rootScope.$broadcast('setLookAndFeel', $scope.note.config.looknfeel);
  };

  var cleanParagraphExcept = function(paragraphId, note) {
    var noteCopy = {};
    noteCopy.id = note.id;
    noteCopy.name = note.name;
    noteCopy.config = note.config;
    noteCopy.info = note.info;
    noteCopy.paragraphs = [];
    for (var i=0; i<note.paragraphs.length; i++) {
      if (note.paragraphs[i].id === paragraphId) {
        noteCopy.paragraphs[0] = note.paragraphs[i];
        if (!noteCopy.paragraphs[0].config) {
          noteCopy.paragraphs[0].config = {};
        }
        noteCopy.paragraphs[0].config.editorHide = true;
        noteCopy.paragraphs[0].config.tableHide = false;
        break;
      }
    }
    return noteCopy;
  };

  $scope.$on('moveParagraphUp', function(event, paragraphId) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ($scope.note.paragraphs[i].id === paragraphId) {
        newIndex = i-1;
        break;
      }
    }
    if (newIndex<0 || newIndex>=$scope.note.paragraphs.length) {
      return;
    }
    // save dirtyText of moving paragraphs.
    var prevParagraphId = $scope.note.paragraphs[newIndex].id;
    angular.element('#' + paragraphId + '_paragraphColumn_main').scope().saveParagraph();
    angular.element('#' + prevParagraphId + '_paragraphColumn_main').scope().saveParagraph();
    websocketMsgSrv.moveParagraph(paragraphId, newIndex);
  });

  // create new paragraph on current position
  $scope.$on('insertParagraph', function(event, paragraphId, position) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ( $scope.note.paragraphs[i].id === paragraphId ) {
        //determine position of where to add new paragraph; default is below
        if ( position === 'above' ) {
          newIndex = i;
        } else {
          newIndex = i+1;
        }
        break;
      }
    }

    if (newIndex < 0 || newIndex > $scope.note.paragraphs.length) {
      return;
    }
    websocketMsgSrv.insertParagraph(newIndex);
  });

  $scope.$on('moveParagraphDown', function(event, paragraphId) {
    var newIndex = -1;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if ($scope.note.paragraphs[i].id === paragraphId) {
        newIndex = i+1;
        break;
      }
    }

    if (newIndex<0 || newIndex>=$scope.note.paragraphs.length) {
      return;
    }
    // save dirtyText of moving paragraphs.
    var nextParagraphId = $scope.note.paragraphs[newIndex].id;
    angular.element('#' + paragraphId + '_paragraphColumn_main').scope().saveParagraph();
    angular.element('#' + nextParagraphId + '_paragraphColumn_main').scope().saveParagraph();
    websocketMsgSrv.moveParagraph(paragraphId, newIndex);
  });

  $scope.$on('moveFocusToPreviousParagraph', function(event, currentParagraphId){
    var focus = false;
    for (var i=$scope.note.paragraphs.length-1; i>=0; i--) {
      if (focus === false ) {
        if ($scope.note.paragraphs[i].id === currentParagraphId) {
          focus = true;
          continue;
        }
      } else {
        var p = $scope.note.paragraphs[i];
        if (!p.config.hide && !p.config.editorHide) {
          $scope.$broadcast('focusParagraph', $scope.note.paragraphs[i].id, -1);
          break;
        }
      }
    }
  });

  $scope.$on('moveFocusToNextParagraph', function(event, currentParagraphId){
    var focus = false;
    for (var i=0; i<$scope.note.paragraphs.length; i++) {
      if (focus === false ) {
        if ($scope.note.paragraphs[i].id === currentParagraphId) {
          focus = true;
          continue;
        }
      } else {
        var p = $scope.note.paragraphs[i];
        if (!p.config.hide && !p.config.editorHide) {
          $scope.$broadcast('focusParagraph', $scope.note.paragraphs[i].id, 0);
          break;
        }
      }
    }
  });

  var updateNote = function(note) {
    /** update Note name */
    if (note.name !== $scope.note.name) {
      console.log('change note name: %o to %o', $scope.note.name, note.name);
      $scope.note.name = note.name;
    }

    $scope.note.config = note.config;
    $scope.note.info = note.info;

    var newParagraphIds = note.paragraphs.map(function(x) {return x.id;});
    var oldParagraphIds = $scope.note.paragraphs.map(function(x) {return x.id;});

    var numNewParagraphs = newParagraphIds.length;
    var numOldParagraphs = oldParagraphIds.length;

    /** add a new paragraph */
    if (numNewParagraphs > numOldParagraphs) {
      for (var index in newParagraphIds) {
        if (oldParagraphIds[index] !== newParagraphIds[index]) {
          $scope.note.paragraphs.splice(index, 0, note.paragraphs[index]);
          break;
        }
        $scope.$broadcast('updateParagraph', {paragraph: note.paragraphs[index]});
      }
    }

    /** update or move paragraph */
    if (numNewParagraphs === numOldParagraphs) {
      for (var idx in newParagraphIds) {
        var newEntry = note.paragraphs[idx];
        if (oldParagraphIds[idx] === newParagraphIds[idx]) {
          $scope.$broadcast('updateParagraph', {paragraph: newEntry});
        } else {
          // move paragraph
          var oldIdx = oldParagraphIds.indexOf(newParagraphIds[idx]);
          $scope.note.paragraphs.splice(oldIdx, 1);
          $scope.note.paragraphs.splice(idx, 0, newEntry);
          // rebuild id list since paragraph has moved.
          oldParagraphIds = $scope.note.paragraphs.map(function(x) {return x.id;});
        }
      }
    }

    /** remove paragraph */
    if (numNewParagraphs < numOldParagraphs) {
      for (var oldidx in oldParagraphIds) {
        if(oldParagraphIds[oldidx] !== newParagraphIds[oldidx]) {
          $scope.note.paragraphs.splice(oldidx, 1);
          break;
        }
      }
    }
  };

  var getInterpreterBindings = function(callback) {
    $http.get(baseUrlSrv.getRestApiBase()+ '/notebook/interpreter/bind/' +$scope.note.id).
    success(function(data, status, headers, config) {
      $scope.interpreterBindings = data.body;
      $scope.interpreterBindingsOrig = angular.copy($scope.interpreterBindings); // to check dirty
      if (callback) {
        callback();
      }
    }).
    error(function(data, status, headers, config) {
      if (status !== 0) {
        console.log('Error %o %o', status, data.message);
      }
    });
  };

  var getInterpreterBindingsCallBack = function() {
    var selected = false;
    var key;
    var setting;

    for (key in $scope.interpreterBindings) {
      setting = $scope.interpreterBindings[key];
      if (setting.selected) {
        selected = true;
        break;
      }
    }

    if (!selected) {
      // make default selection
      var selectedIntp = {};
      for (key in $scope.interpreterBindings) {
        setting = $scope.interpreterBindings[key];
        if (!selectedIntp[setting.group]) {
          setting.selected = true;
          selectedIntp[setting.group] = true;
        }
      }
      $scope.showSetting = true;
    }
  };

  $scope.interpreterSelectionListeners = {
    accept : function(sourceItemHandleScope, destSortableScope) {return true;},
    itemMoved: function (event) {},
    orderChanged: function(event) {}
  };

  $scope.openSetting = function() {
    $scope.showSetting = true;
    getInterpreterBindings();
  };

  $scope.closeSetting = function() {
    if (isSettingDirty()) {
      BootstrapDialog.confirm({
        closable: true,
        title: '',
        message: 'Changes will be discarded.',
        callback: function(result) {
          if (result) {
            $scope.$apply(function() {
              $scope.showSetting = false;
            });
          }
        }
      });
    } else {
      $scope.showSetting = false;
    }
  };

  $scope.saveSetting = function() {
    var selectedSettingIds = [];
    for (var no in $scope.interpreterBindings) {
      var setting = $scope.interpreterBindings[no];
      if (setting.selected) {
        selectedSettingIds.push(setting.id);
      }
    }

    $http.put(baseUrlSrv.getRestApiBase() + '/notebook/interpreter/bind/' + $scope.note.id,
              selectedSettingIds).
    success(function(data, status, headers, config) {
      console.log('Interpreter binding %o saved', selectedSettingIds);
      $scope.showSetting = false;
    }).
    error(function(data, status, headers, config) {
      console.log('Error %o %o', status, data.message);
    });
  };

  $scope.toggleSetting = function() {
    if ($scope.showSetting) {
      $scope.closeSetting();
    } else {
      $scope.openSetting();
    }
  };

  var isSettingDirty = function() {
    if (angular.equals($scope.interpreterBindings, $scope.interpreterBindingsOrig)) {
      return false;
    } else {
      return true;
    }
  };

  $scope.$on('angularObjectUpdate', function(event, data) {
    if (data.noteId === $scope.note.id) {
      var scope = $rootScope.compiledScope;
      var varName = data.angularObject.name;

      if (angular.equals(data.angularObject.object, scope[varName])) {
        // return when update has no change
        return;
      }

      if (!angularObjectRegistry[varName]) {
        angularObjectRegistry[varName] = {
          interpreterGroupId : data.interpreterGroupId,
        };
      }

      angularObjectRegistry[varName].skipEmit = true;

      if (!angularObjectRegistry[varName].clearWatcher) {
        angularObjectRegistry[varName].clearWatcher = scope.$watch(varName, function(newValue, oldValue) {
          if (angularObjectRegistry[varName].skipEmit) {
            angularObjectRegistry[varName].skipEmit = false;
            return;
          }
          websocketMsgSrv.updateAngularObject($routeParams.noteId, varName, newValue, angularObjectRegistry[varName].interpreterGroupId);
        });
      }
      scope[varName] = data.angularObject.object;
    }
  });

  $scope.$on('angularObjectRemove', function(event, data) {
    if (!data.noteId || data.noteId === $scope.note.id) {
      var scope = $rootScope.compiledScope;
      var varName = data.name;

      // clear watcher
      if (angularObjectRegistry[varName]) {
        angularObjectRegistry[varName].clearWatcher();
        angularObjectRegistry[varName] = undefined;
      }

      // remove scope variable
      scope[varName] = undefined;
    }
  });

});
