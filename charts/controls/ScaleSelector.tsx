/* ScaleSelector.jsx
 * ================
 *
 * Small toggle component for switching between log/linear (or any other) scale types.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "charts/core/ChartConstants"

export interface ScaleTypeConfig {
    scaleType: ScaleType // This is assumed to be observable.
    scaleTypeOptions: ScaleType[] // This is assumed to be observable.
    updateChartScaleType?: (scaleType: ScaleType) => void
}

interface ScaleSelectorOptions {
    x: number
    y: number
    maxX?: number
    scaleTypeConfig: ScaleTypeConfig
    onScaleTypeChange?: (scaleType: ScaleType) => void
}

@observer
export class ScaleSelector extends React.Component<ScaleSelectorOptions> {
    @computed get x(): number {
        return this.props.x
    }
    @computed get y(): number {
        return this.props.y
    }

    @computed get maxX(): number {
        return this.props.maxX || 0
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        return this.props.scaleTypeConfig.scaleTypeOptions
    }

    @computed get scaleType(): ScaleType {
        return this.props.scaleTypeConfig.scaleType
    }

    @action.bound onClick() {
        const { scaleType, scaleTypeOptions } = this

        let nextScaleTypeIndex = scaleTypeOptions.indexOf(scaleType) + 1
        if (nextScaleTypeIndex >= scaleTypeOptions.length)
            nextScaleTypeIndex = 0

        const newValue = scaleTypeOptions[nextScaleTypeIndex]

        if (this.props.onScaleTypeChange) this.props.onScaleTypeChange(newValue)
        else if (this.props.scaleTypeConfig.updateChartScaleType)
            this.props.scaleTypeConfig.updateChartScaleType(newValue)
        else this.props.scaleTypeConfig.scaleType = newValue
    }

    private componentWidth = 95

    private getLeftShiftIfNeeded(xPosition: number) {
        if (!this.maxX) return 0
        const overflow = this.maxX - (xPosition + this.componentWidth)
        let shiftLeft = 0
        if (overflow < 0) shiftLeft = Math.abs(overflow)
        return shiftLeft
    }

    render() {
        const { x, y, onClick, scaleType } = this

        const style = {
            left: x - this.getLeftShiftIfNeeded(x),
            top: y
        }
        return (
            <div
                onClick={onClick}
                style={style as any}
                className="clickable toggleSwitch"
            >
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "leftToggle " +
                        (scaleType === ScaleType.linear ? "activeToggle" : "")
                    }
                >
                    Linear
                </span>
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "rightToggle " +
                        (scaleType === ScaleType.log ? "activeToggle" : "")
                    }
                >
                    Log
                </span>
            </div>
        )
    }
}
