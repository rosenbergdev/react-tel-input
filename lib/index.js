'use strict';

var some = require('lodash/collection/some');
var findWhere = require('lodash/collection/findWhere');
var reduce = require('lodash/collection/reduce');
var map = require('lodash/collection/map');
var filter = require('lodash/collection/filter');
var findIndex = require('lodash/array/findIndex');
var first = require('lodash/array/first');
var rest = require('lodash/array/rest');
var debounce = require('lodash/function/debounce');
var memoize = require('lodash/function/memoize');
// import lodash string methods
var trim = require('lodash/string/trim');
var onClickOutside = require('react-onclickoutside');
var startsWith = require('lodash/string/startsWith');

var React = require('react');
var classNames = require('classnames');
var countryData = require('./country_data');
var allCountries = countryData.allCountries;

var isModernBrowser;
if (typeof document !== 'undefined') {
    isModernBrowser = Boolean(document.createElement('input').setSelectionRange);
} else {
    isModernBrowser = true;
}

var keys = {
    UP: 38,
    DOWN: 40,
    RIGHT: 39,
    LEFT: 37,
    ENTER: 13,
    ESC: 27,
    PLUS: 43,
    A: 65,
    Z: 90,
    SPACE: 32
};

function isNumberValid(inputNumber) {
    var countries = countryData.allCountries;
    return some(countries, function (country) {
        return startsWith(inputNumber, country.dialCode) || startsWith(country.dialCode, inputNumber);
    });
}

function findCountry(country) {
    if (typeof country === 'string' && country.length === 2) {
        return findWhere(allCountries, { iso2: country });
    }
    return country;
}

var ReactTelephoneInput = React.createClass({
    displayName: 'ReactTelephoneInput',
    mixins: [onClickOutside],

    getInitialState: function getInitialState() {
        var countries = this.props.onlyCountries ? map(this.props.onlyCountries, findCountry) : allCountries;
        var preferredCountries = map(this.props.preferredCountries, findCountry);

        var inputNumber = this.props.value || '';
        var selectedCountryGuess = this.guessSelectedCountry(inputNumber.replace(/\D/g, ''), countries);
        var selectedCountryGuessIndex = findIndex(allCountries, selectedCountryGuess);
        var formattedNumber = this.formatNumber(inputNumber.replace(/\D/g, ''), selectedCountryGuess ? selectedCountryGuess.format : null);

        return {
            countries: countries,
            preferredCountries: preferredCountries,
            selectedCountry: selectedCountryGuess,
            highlightCountryIndex: selectedCountryGuessIndex,
            formattedNumber: '',
            showDropDown: false,
            queryString: '',
            freezeSelection: false,
            debouncedQueryStingSearcher: debounce(this.searchCountry, 100)
        };
    },
    propTypes: {
        value: React.PropTypes.string,
        autoFormat: React.PropTypes.bool,
        defaultCountry: React.PropTypes.string,
        disabled: React.PropTypes.bool,
        onlyCountries: React.PropTypes.any,
        preferredCountries: React.PropTypes.any,
        onChange: React.PropTypes.func,
        onEnterKeyPress: React.PropTypes.func
    },
    getDefaultProps: function getDefaultProps() {
        return {
            value: '',
            autoFormat: true,
            disabled: false,
            onlyCountries: allCountries,
            defaultCountry: allCountries[0].iso2,
            isValid: isNumberValid,
            flagsImagePath: 'flags.png',
            placeholder: null,
            disableFlagsList: false,
            onEnterKeyPress: function onEnterKeyPress() {}
        };
    },
    getNumber: function getNumber() {
        return this.state.formattedNumber !== '+' ? this.state.formattedNumber : '';
    },

    getValue: function getValue() {
        return this.getNumber();
    },

    componentDidMount: function componentDidMount() {
        document.addEventListener('keydown', this.handleKeydown);

        // this._cursorToEnd();
        //if (typeof this.props.onChange === 'function') {
        //  this.props.onChange(this.state.formattedNumber);
        //}
        if (this.props.initialValue) {
            this.setState({
                formattedNumber: this.props.initialValue
            })
        }
    },
    componentWillUnmount: function componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeydown);
    },
    scrollTo: function scrollTo(country, middle) {
        if (!country) {
            return;
        }

        var container = this.refs.flagDropdownList;

        if (!container) {
            return;
        }

        var containerHeight = container.offsetHeight;
        var containerOffset = container.getBoundingClientRect();
        var containerTop = containerOffset.top + document.body.scrollTop;
        var containerBottom = containerTop + containerHeight;

        var element = country;
        var elementOffset = element.getBoundingClientRect();

        var elementHeight = element.offsetHeight;
        var elementTop = elementOffset.top + document.body.scrollTop;
        var elementBottom = elementTop + elementHeight;
        var newScrollTop = elementTop - containerTop + container.scrollTop;
        var middleOffset = containerHeight / 2 - elementHeight / 2;

        if (elementTop < containerTop) {
            // scroll up
            if (middle) {
                newScrollTop -= middleOffset;
            }
            container.scrollTop = newScrollTop;
        } else if (elementBottom > containerBottom) {
            // scroll down
            if (middle) {
                newScrollTop += middleOffset;
            }
            var heightDifference = containerHeight - elementHeight;
            container.scrollTop = newScrollTop - heightDifference;
        }
    },
    formatNumber: function formatNumber(text, pattern) {
        if (!text || text.length === 0) {
            return '+';
        }

        // for all strings with length less than 3, just return it (1, 2 etc.)
        // also return the same text if the selected country has no fixed format
        if (text && text.length < 2 || !pattern || !this.props.autoFormat) {
            return '+' + text;
        }

        var formattedObject = reduce(pattern, function (acc, character) {
            if (acc.remainingText.length === 0) {
                return acc;
            }

            if (character !== '.') {
                return {
                    formattedText: acc.formattedText + character,
                    remainingText: acc.remainingText
                };
            }

            return {
                formattedText: acc.formattedText + first(acc.remainingText),
                remainingText: rest(acc.remainingText)
            };
        }, { formattedText: '', remainingText: text.split('') });
        return formattedObject.formattedText + formattedObject.remainingText.join('');
    },

    // put the cursor to the end of the input (usually after a focus event)
    _cursorToEnd: function _cursorToEnd() {
        var input = this.refs.numberInput;
        input.focus();
        if (isModernBrowser) {
            var len = input.value.length;
            input.setSelectionRange(len, len);
        }
    },
    // memoize results based on the first 5/6 characters. That is all that matters
    guessSelectedCountry: memoize(function (inputNumber, countries) {
        // This gets called during getInitialState and so needs to be provided country
        countries = this.state && this.state.countries || countries;

        var secondBestGuess = findWhere(allCountries, { iso2: this.props.defaultCountry }) || countries[0];
        if (trim(inputNumber) !== '') {
            var bestGuess = reduce(countries, function (selectedCountry, country) {
                if (startsWith(inputNumber, country.dialCode)) {
                    if (country.dialCode.length > selectedCountry.dialCode.length) {
                        return country;
                    }
                    if (country.dialCode.length === selectedCountry.dialCode.length && country.priority < selectedCountry.priority) {
                        return country;
                    }
                }

                return selectedCountry;
            }, { dialCode: '', priority: 10001 }, this);
        } else {
            return secondBestGuess;
        }

        if (!bestGuess.name) {
            return secondBestGuess;
        }

        return bestGuess;
    }),
    getElement: function getElement(index) {
        return this.refs['flag_no_' + index];
    },
    handleFlagDropdownClick: function handleFlagDropdownClick() {
        var _this = this;

        if (!this.props.disableFlagsList) {
          this.setState({
              showDropDown: !this.state.showDropDown
          });
        }

        // need to put the highlight on the current selected country if the dropdown is going to open up
        this.setState({
            // showDropDown: !this.state.showDropDown,
            highlightCountry: findWhere(this.state.countries, this.state.selectedCountry),
            highlightCountryIndex: findIndex(this.state.countries, this.state.selectedCountry)
        }, function () {
            // only need to scrool if the dropdown list is alive
            if (_this.state.showDropDown) {
                _this.scrollTo(_this.getElement(_this.state.highlightCountryIndex + _this.state.preferredCountries.length));
            }
        });
    },
    handleInput: function handleInput(event) {
        var formattedNumber = '+',
          newSelectedCountry = this.state.selectedCountry,
          freezeSelection = this.state.freezeSelection;

        // if the input is the same as before, must be some special key like enter etc.
        if (event.target.value === this.state.formattedNumber) {
            return;
        }

        // ie hack
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }

        if (event.target.value.length > 0) {
            // before entering the number in new format, lets check if the dial code now matches some other country
            var inputNumber = event.target.value.replace(/\D/g, '');

            // we don't need to send the whole number to guess the country... only the first 6 characters are enough
            // the guess country function can then use memoization much more effectively since the set of input it gets has drastically reduced
            if (!this.state.freezeSelection || this.state.selectedCountry.dialCode.length > inputNumber.length) {
                newSelectedCountry = this.guessSelectedCountry(inputNumber.substring(0, 6));
                freezeSelection = false;
            }
            // let us remove all non numerals from the input
            formattedNumber = this.formatNumber(inputNumber, newSelectedCountry.format);
        }

        var caretPosition = event.target.selectionStart;
        var oldFormattedText = this.state.formattedNumber;
        var diff = formattedNumber.length - oldFormattedText.length;

        this.setState({
            formattedNumber: formattedNumber,
            freezeSelection: freezeSelection,
            selectedCountry: newSelectedCountry.dialCode.length > 0 ? newSelectedCountry : this.state.selectedCountry
        }, function () {
            if (isModernBrowser) {
                if (diff > 0) {
                    caretPosition = caretPosition - diff;
                }

                if (caretPosition > 0 && oldFormattedText.length >= formattedNumber.length) {
                    this.refs.numberInput.setSelectionRange(caretPosition, caretPosition);
                }
            }

            if (this.props.onChange) {
                this.props.onChange(this.state.formattedNumber);
            }
        });
    },
    handleInputClick: function handleInputClick() {
        this.setState({ showDropDown: false });
    },
    handleClickOutside: function handleClickOutside() {
        if (this.state.showDropDown) {
            this.setState({
                showDropDown: false
            });
        }
    },
    handleFlagItemClick: function handleFlagItemClick(country) {
        var currentSelectedCountry = this.state.selectedCountry;
        var nextSelectedCountry = findWhere(this.state.countries, country);

        // tiny optimization
        if (currentSelectedCountry.iso2 !== nextSelectedCountry.iso2) {
            // TODO - the below replacement is a bug. It will replace stuff from middle too
            var newNumber = this.state.formattedNumber.replace(currentSelectedCountry.dialCode, nextSelectedCountry.dialCode);
            var formattedNumber = this.formatNumber(newNumber.replace(/\D/g, ''), nextSelectedCountry.format);

            this.setState({
                showDropDown: false,
                selectedCountry: nextSelectedCountry,
                freezeSelection: true,
                formattedNumber: formattedNumber
            }, function () {
                // this._cursorToEnd();
                if (this.props.onChange) {
                    this.props.onChange(formattedNumber);
                }
            });
        }
    },
    handleInputFocus: function handleInputFocus() {
        // if the input is blank, insert dial code of the selected country
        if (this.refs.numberInput.value === '+' || this.refs.numberInput.value === '') {
            this.setState({ formattedNumber: '+' + this.state.selectedCountry.dialCode });
        }
        if(this.props.onFocus) {
            this.props.onFocus();
        };
    },
    handleInputBlur: function handleInputFocus() {
        if(this.props.onBlur) {
            this.props.onBlur();
        };
    },
    _getHighlightCountryIndex: function _getHighlightCountryIndex(direction) {
        // had to write own function because underscore does not have findIndex. lodash has it
        var highlightCountryIndex = this.state.highlightCountryIndex + direction;

        if (highlightCountryIndex < 0 || highlightCountryIndex >= this.state.countries.length + this.state.preferredCountries.length) {
            return highlightCountryIndex - direction;
        }

        return highlightCountryIndex;
    },
    // memoize search results... caching all the way
    _searchCountry: memoize(function (queryString) {
        if (!queryString || queryString.length === 0) {
            return null;
        }
        // don't include the preferred countries in search
        var probableCountries = filter(this.state.countries, function (country) {
            return startsWith(country.name.toLowerCase(), queryString.toLowerCase());
        }, this);
        return probableCountries[0];
    }),
    searchCountry: function searchCountry() {
        var probableCandidate = this._searchCountry(this.state.queryString) || this.state.countries[0];
        var probableCandidateIndex = findIndex(this.state.countries, probableCandidate) + this.state.preferredCountries.length;

        this.scrollTo(this.getElement(probableCandidateIndex), true);

        this.setState({
            queryString: '',
            highlightCountryIndex: probableCandidateIndex
        });
    },
    handleKeydown: function handleKeydown(event) {
        if (!this.state.showDropDown) {
            return;
        }

        // ie hack
        if (event.preventDefault) {
            event.preventDefault();
        } else {
            event.returnValue = false;
        }

        function _moveHighlight(direction) {
            var _this2 = this;

            this.setState({
                highlightCountryIndex: this._getHighlightCountryIndex(direction)
            }, function () {
                _this2.scrollTo(_this2.getElement(_this2.state.highlightCountryIndex), true);
            });
        }

        switch (event.which) {
            case keys.DOWN:
                _moveHighlight(1);
                break;
            case keys.UP:
                _moveHighlight(-1);
                break;
            case keys.ENTER:
                this.handleFlagItemClick(this.state.countries[this.state.highlightCountryIndex], event);
                break;
            case keys.ESC:
                // this.setState({ showDropDown: false }, this._cursorToEnd);
                break;
            default:
                if (event.which >= keys.A && event.which <= keys.Z || event.which === keys.SPACE) {
                    this.setState({ queryString: this.state.queryString + String.fromCharCode(event.which) }, this.state.debouncedQueryStingSearcher);
                }
        }
    },
    handleInputKeyDown: function handleInputKeyDown(event) {
        if (event.which === keys.ENTER) {
            this.props.onEnterKeyPress(event);
        }
    },
    getCountryDropDownList: function getCountryDropDownList() {
        var _this3 = this;

        var _state = this.state;
        var preferredCountries = _state.preferredCountries;
        var countries = _state.countries;

        var countryDropDownList = map(preferredCountries.concat(countries), function (country, index) {

            var itemClasses = classNames({
                country: true,
                preferred: country.iso2 === 'us' || country.iso2 === 'gb',
                active: country.iso2 === 'us',
                highlight: _this3.state.highlightCountryIndex === index
            });

            return React.createElement(
              'li',
              {
                  ref: 'flag_no_' + index,
                  key: 'flag_no_' + index,
                  'data-flag-key': 'flag_no_' + index,
                  className: itemClasses,
                  'data-dial-code': "1",
                  'data-country-code': country.iso2,
                  onClick: _this3.handleFlagItemClick.bind(_this3, country) },
              React.createElement('div', { className: 'flag ' + country.iso2, style: _this3.getFlagStyle() }),
              React.createElement(
                'span',
                { className: 'country-name' },
                country.name
              ),
              React.createElement(
                'span',
                { className: 'dial-code' },
                '+' + country.dialCode
              )
            );
        });

        // let's insert a dashed line in between preffered countries and the rest IF we have any preferred countries
        if (this.state.preferredCountries.length) {
            var dashedLi = React.createElement('li', { key: "dashes", className: "divider" });
            countryDropDownList.splice(this.state.preferredCountries.length, 0, dashedLi);
        }

        var dropDownClasses = classNames({
            'country-list': true,
            'hide': !this.state.showDropDown
        });
        return React.createElement(
          'ul',
          { ref: "flagDropdownList", className: dropDownClasses },
          countryDropDownList
        );
    },
    getFlagStyle: function getFlagStyle() {
        return {
            width: 16,
            height: 11,
            backgroundImage: 'url(' + this.props.flagsImagePath + ')'
        };
    },
    render: function render() {
        var arrowClasses = classNames({
            'arrow': true,
            'up': this.state.showDropDown
        });
        var inputClasses = classNames({
            'form-control': true,
            'invalid-number': !this.props.isValid(this.state.formattedNumber.replace(/\D/g, ''))
        });

        var flagViewClasses = classNames({
            'flag-dropdown': true,
            'open-dropdown': this.state.showDropDown
        });

        var inputFlagClasses = 'flag ' + this.state.selectedCountry.iso2;
        var selectedFlagDisabled = this.props.disableFlagsList ? ' flag-list-disabled' : ' ';

        return React.createElement(
          'div',
          { className: 'react-tel-input' },
          React.createElement('input', {
              onChange: this.handleInput,
              onClick: this.handleInputClick,
              onFocus: this.handleInputFocus,
              onBlur: this.handleInputBlur,
              onKeyDown: this.handleInputKeyDown,
              disabled: this.props.disabled,
              value: this.state.formattedNumber,
              ref: "numberInput",
              type: "tel",
              className: inputClasses,
              name: this.props.name,
              placeholder: this.props.placeholder}),
          React.createElement(
            'div',
            { ref: 'flagDropDownButton', className: flagViewClasses + selectedFlagDisabled, onKeyDown: this.handleKeydown },
            React.createElement(
              'div',
              { ref: 'selectedFlag', onClick: this.handleFlagDropdownClick, className: 'selected-flag', title: this.state.selectedCountry.name + ': + ' + this.state.selectedCountry.dialCode },
              React.createElement(
                'div',
                { className: inputFlagClasses, style: this.getFlagStyle() },
                React.createElement('div', { className: arrowClasses })
              )
            ),
            this.state.showDropDown ? this.getCountryDropDownList() : ''
          )
        );
    }
});

module.exports = ReactTelephoneInput;
